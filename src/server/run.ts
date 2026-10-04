import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { coveragePercent } from "@/analysis/coverage";
import type { Stage } from "@/analysis/stage";
import { downloadArchive, describePublicRepository } from "@/archive/github";
import { selectRoot } from "@/archive/select";
import { parseRepository } from "@/parser/parse";
import type { ParseResult } from "@/parser/types";
import { beginRun, finishRun, noteRunDirectory, runIntent } from "@/server/active-runs";
import { createDatabaseClientWithToken } from "@/server/database";
import type { Database } from "@/types/database";

type Client = ReturnType<typeof createDatabaseClientWithToken>;
type FileInsert = Database["public"]["Tables"]["files"]["Insert"];
type EdgeInsert = Database["public"]["Tables"]["edges"]["Insert"];

const BATCH = 400;

// Fetch, select, parse, store. A failure writes the stage it died in and why,
// so the row cannot sit on "running" after an error we caught.
export async function runAnalysis(input: {
  id: number;
  owner: string;
  repo: string;
  organizationId: string;
  token: string;
  getToken: () => Promise<string | null>;
}): Promise<void> {
  let stage: Stage = "fetch";
  let directory: string | undefined;
  const controller = beginRun(input.id);
  const signal = controller.signal;
  const db = createDatabaseClientWithToken(async () => {
    try {
      const fresh = await input.getToken();
      if (fresh) return fresh;
    } catch {
      // After the response is sent, the request session may already be gone.
    }
    return input.token;
  });

  try {
    directory = await mkdtemp(path.join(os.tmpdir(), "cartograph-"));
    noteRunDirectory(input.id, controller, directory);
    const described = await describePublicRepository(input.owner, input.repo, signal);
    await write(
      db
        .from("analyses")
        .update({ commit_sha: described.sha, repository: described.url })
        .eq("id", input.id),
      "record the commit",
    );

    const extracted = await downloadArchive({
      owner: described.owner,
      repo: described.repo,
      sha: described.sha,
      destination: directory,
      signal,
    });

    stage = "select";
    throwIfStopped(signal);
    await setStage(db, input.id, stage, "Selecting the repository root");
    const root = selectRoot(extracted);

    stage = "parse";
    throwIfStopped(signal);
    await setStage(db, input.id, stage, "Parsing imports");
    const result = await parseRepository(root, undefined, signal);

    stage = "store";
    throwIfStopped(signal);
    await setStage(db, input.id, stage, "Storing the map");
    await storeResult(db, input.id, input.organizationId, result, signal);
    throwIfStopped(signal);
    await markComplete(db, input.id, result);
  } catch (error) {
    // A delete is waiting to remove the row. Writing a failure here would
    // recreate the analysis that delete is about to remove.
    if (runIntent(input.id) !== "delete") {
      const message = signal.aborted ? "Stopped." : error instanceof Error ? error.message : String(error);
      await markFailed(db, input.id, stage, message);
    }
  } finally {
    if (directory) await rm(directory, { recursive: true, force: true });
    finishRun(input.id, controller);
  }
}

function throwIfStopped(signal: AbortSignal): void {
  if (signal.aborted) throw new Error("Stopped.");
}

async function setStage(db: Client, id: number, stage: Stage, message: string): Promise<void> {
  await write(
    db.from("analyses").update({ stage, stage_message: message }).eq("id", id),
    "record the stage",
  );
}

async function storeResult(
  db: Client,
  id: number,
  organizationId: string,
  result: ParseResult,
  signal: AbortSignal,
): Promise<void> {
  const files: FileInsert[] = result.files.map((file) => ({
    analysis_id: id,
    organization_id: organizationId,
    path: file.path,
    folder: file.folder,
    lines: file.lines,
    hash: file.hash,
    fan_in: file.fanIn,
    fan_out: file.fanOut,
  }));
  const edges: EdgeInsert[] = result.edges.map((edge) => ({
    analysis_id: id,
    organization_id: organizationId,
    from_path: edge.from,
    to_path: edge.to,
    kind: edge.kind,
    specifier: edge.specifier,
  }));
  for (const batch of chunks(files, BATCH)) {
    throwIfStopped(signal);
    await write(db.from("files").insert(batch), "store files");
  }
  for (const batch of chunks(edges, BATCH)) {
    throwIfStopped(signal);
    await write(db.from("edges").insert(batch), "store edges");
  }
}

async function markComplete(db: Client, id: number, result: ParseResult): Promise<void> {
  const counts = importCounts(result);
  await write(
    db
      .from("analyses")
      .update({
        state: "complete",
        stage: "store",
        stage_message: "Stored",
        failure: null,
        adapter: result.adapter,
        files_found: result.counts.found,
        files_parsed: result.counts.parsed,
        files_skipped: result.counts.skipped,
        imports_seen: result.imports.length,
        imports_resolved: counts.resolved,
        imports_unresolved: counts.unresolved,
        coverage_percent: coveragePercent(counts.resolved, counts.unresolved),
        analysed_at: new Date().toISOString(),
      })
      .eq("id", id),
    "finish the analysis",
  );
}

async function markFailed(db: Client, id: number, stage: Stage, message: string): Promise<void> {
  const files = await db.from("files").delete().eq("analysis_id", id);
  if (files.error) console.error(files.error.message);
  const edges = await db.from("edges").delete().eq("analysis_id", id);
  if (edges.error) console.error(edges.error.message);
  const failed = await db
    .from("analyses")
    .update({
      state: "failed",
      stage,
      stage_message: message,
      failure: message,
      analysed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (failed.error) console.error(failed.error.message);
}

function importCounts(result: ParseResult): { resolved: number; unresolved: number } {
  let resolved = 0;
  let unresolved = 0;
  for (const sighting of result.imports) {
    if (sighting.status === "resolved") resolved += 1;
    else if (sighting.status === "unresolved") unresolved += 1;
  }
  return { resolved, unresolved };
}

function chunks<T>(items: readonly T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

async function write(
  query: PromiseLike<{ error: { message: string } | null }>,
  action: string,
): Promise<void> {
  const { error } = await query;
  if (error) throw new Error(`Could not ${action}: ${error.message}`);
}
