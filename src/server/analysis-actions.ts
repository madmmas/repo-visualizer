"use server";

import { auth } from "@clerk/nextjs/server";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { analysisPath } from "@/analysis/path";
import { isStale } from "@/analysis/stale";
import { previewPublicRepository, TOO_BIG_MESSAGE } from "@/archive/github";
import { parseRepositoryUrl } from "@/archive/url";
import { cancelRun } from "@/server/active-runs";
import { createDatabaseClientWithToken } from "@/server/database";
import { runAnalysis } from "@/server/run";

export async function rerunAnalysis(id: number): Promise<{ error: string } | void> {
  const ready = await openAnalysis(id);
  if (!ready.ok) return { error: ready.error };
  const { db, orgId, token, getToken, row } = ready;

  if ((row.state === "running" || row.state === "queued") && !isStale(row.state, row.updated_at)) {
    return { error: "This run is still going." };
  }

  const name = parseRepositoryUrl(row.repository);
  if (!name) return { error: "This analysis has no GitHub repository URL to fetch." };

  let bytes: number | null = null;
  let repositoryFiles: number | null = null;
  try {
    const preview = await previewPublicRepository(name.owner, name.repo);
    if (preview.tooBig) return { error: TOO_BIG_MESSAGE };
    bytes = preview.sizeKnown ? preview.sizeBytes : null;
    repositoryFiles = preview.files;
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }

  const edges = await db.from("edges").delete().eq("analysis_id", id);
  if (edges.error) return { error: edges.error.message };
  const files = await db.from("files").delete().eq("analysis_id", id);
  if (files.error) return { error: files.error.message };

  const started = await db
    .from("analyses")
    .update({
      repository: name.url,
      state: "running",
      stage: "fetch",
      stage_message: "Fetching the archive",
      failure: null,
      commit_sha: null,
      adapter: null,
      files_found: null,
      files_parsed: null,
      files_skipped: null,
      imports_seen: null,
      imports_resolved: null,
      imports_unresolved: null,
      coverage_percent: null,
      analysed_at: null,
      started_at: new Date().toISOString(),
      repository_bytes: bytes,
      repository_files: repositoryFiles,
    })
    .eq("id", id);
  if (started.error) return { error: started.error.message };

  after(() =>
    runAnalysis({
      id,
      owner: name.owner,
      repo: name.repo,
      organizationId: orgId,
      token,
      getToken,
    }),
  );
  redirect(analysisPath(id, "running"));
}

export async function stopAnalysis(id: number): Promise<{ error: string } | void> {
  const ready = await openAnalysis(id);
  if (!ready.ok) return { error: ready.error };
  if (ready.row.state !== "running" && ready.row.state !== "queued") {
    return { error: "This run is not going." };
  }

  const live = await cancelRun(id, "stop");
  if (live) return;

  const current = await ready.db.from("analyses").select("state").eq("id", id).maybeSingle();
  if (current.error) return { error: current.error.message };
  if (!current.data || (current.data.state !== "running" && current.data.state !== "queued")) return;

  const cleared = await clearStoredGraph(ready.db, id);
  if (cleared) return { error: cleared };
  const stopped = await ready.db
    .from("analyses")
    .update({
      state: "failed",
      stage_message: "Stopped.",
      failure: "Stopped.",
    })
    .eq("id", id);
  if (stopped.error) return { error: stopped.error.message };
}

export async function deleteAnalysis(id: number): Promise<{ error: string } | void> {
  const ready = await openAnalysis(id);
  if (!ready.ok) return { error: ready.error };

  // Stop first. The run deletes the archive and the extracted tree as it exits,
  // then this removes the row and the stored graph.
  await cancelRun(id, "delete");

  const cleared = await clearStoredGraph(ready.db, id);
  if (cleared) return { error: cleared };
  const deleted = await ready.db.from("analyses").delete().eq("id", id).select("id");
  if (deleted.error) return { error: deleted.error.message };
  if (deleted.data.length === 0) return { error: "That analysis is not in this organization." };
}

async function clearStoredGraph(
  db: ReturnType<typeof createDatabaseClientWithToken>,
  id: number,
): Promise<string | null> {
  const edges = await db.from("edges").delete().eq("analysis_id", id);
  if (edges.error) return edges.error.message;
  const files = await db.from("files").delete().eq("analysis_id", id);
  if (files.error) return files.error.message;
  return null;
}

async function openAnalysis(id: number): Promise<
  | { ok: false; error: string }
  | {
      ok: true;
      db: ReturnType<typeof createDatabaseClientWithToken>;
      orgId: string;
      token: string;
      getToken: () => Promise<string | null>;
      row: { id: number; repository: string; state: string; updated_at: string };
    }
> {
  if (!Number.isInteger(id) || id < 1) return { ok: false, error: "That analysis does not exist." };

  const { orgId, getToken } = await auth();
  if (!orgId) return { ok: false, error: "Sign in to an organization before changing an analysis." };
  const token = await getToken();
  if (!token) return { ok: false, error: "Sign in again before changing an analysis." };

  const db = createDatabaseClientWithToken(async () => token);
  const found = await db
    .from("analyses")
    .select("id, repository, state, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (found.error) return { ok: false, error: found.error.message };
  if (!found.data) return { ok: false, error: "That analysis is not in this organization." };

  return { ok: true, db, orgId, token, getToken, row: found.data };
}
