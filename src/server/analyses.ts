import { isStale } from "@/analysis/stale";
import { createDatabaseClient } from "@/server/database";
import type { Edge, ImportKind, ParsedFile } from "@/parser/types";

export type ListedAnalysis = {
  id: number;
  repository: string;
  state: string;
  stage: string | null;
  message: string | null;
  failure: string | null;
  stale: boolean;
  analysedAt: string | null;
  startedAt: string | null;
  sizeBytes: number | null;
  repositoryFiles: number | null;
  filesFound: number | null;
  filesParsed: number | null;
  filesSkipped: number | null;
};

export type AnalysisProgress = {
  id: number;
  repository: string;
  state: string;
  stage: string | null;
  message: string | null;
  failure: string | null;
  stale: boolean;
  analysedAt: string | null;
  startedAt: string | null;
  sizeBytes: number | null;
  repositoryFiles: number | null;
  filesFound: number | null;
};

export type AnalysisMap = {
  id: number;
  repository: string;
  adapter: string;
  imports: number;
  coveragePercent: number | null;
  files: ParsedFile[];
  edges: Edge[];
};

const LIST_LIMIT = 100;

// The policy on analyses decides which organization's rows come back.
export async function listAnalyses(): Promise<
  { analyses: ListedAnalysis[] } | { error: string }
> {
  const db = await createDatabaseClient();
  const { data, error } = await db
    .from("analyses")
    .select(
      "id, repository, state, stage, stage_message, failure, updated_at, analysed_at, started_at, repository_bytes, repository_files, files_found, files_parsed, files_skipped",
    )
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);

  if (error) return { error: error.message };

  return {
    analyses: data.map((row) => ({
      id: row.id,
      repository: row.repository,
      state: row.state,
      stage: row.stage,
      message: row.stage_message,
      failure: row.failure,
      stale: isStale(row.state, row.updated_at),
      analysedAt: row.analysed_at ?? (row.state === "complete" || row.state === "failed" ? row.updated_at : null),
      startedAt: row.started_at,
      sizeBytes: row.repository_bytes,
      repositoryFiles: row.repository_files,
      filesFound: row.files_found,
      filesParsed: row.files_parsed,
      filesSkipped: row.files_skipped,
    })),
  };
}

export async function getAnalysis(id: number): Promise<AnalysisProgress | null | { error: string }> {
  const db = await createDatabaseClient();
  const { data, error } = await db
    .from("analyses")
    .select(
      "id, repository, state, stage, stage_message, failure, updated_at, analysed_at, started_at, repository_bytes, repository_files, files_found",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return null;
  return {
    id: data.id,
    repository: data.repository,
    state: data.state,
    stage: data.stage,
    message: data.stage_message,
    failure: data.failure,
    stale: isStale(data.state, data.updated_at),
    analysedAt: data.analysed_at ?? (data.state === "complete" || data.state === "failed" ? data.updated_at : null),
    startedAt: data.started_at,
    sizeBytes: data.repository_bytes,
    repositoryFiles: data.repository_files,
    filesFound: data.files_found,
  };
}

export async function getAnalysisMap(
  id: number,
): Promise<AnalysisMap | { incomplete: true } | { error: string } | null> {
  const db = await createDatabaseClient();
  const analysis = await db
    .from("analyses")
    .select("id, repository, state, adapter, imports_seen, coverage_percent")
    .eq("id", id)
    .maybeSingle();
  if (analysis.error) return { error: analysis.error.message };
  if (!analysis.data) return null;
  if (analysis.data.state !== "complete") return { incomplete: true };

  // One request returns at most 1000 rows. The map needs every file and edge
  // of this analysis, so it pages. An unordered page can skip a file an edge
  // still names, and the fold then refuses to draw.
  const files = await eachPage((from, to) =>
    db
      .from("files")
      .select("path, folder, lines, hash, fan_in, fan_out")
      .eq("analysis_id", id)
      .order("path")
      .range(from, to),
  );
  if ("error" in files) return files;

  const edges = await eachPage((from, to) =>
    db
      .from("edges")
      .select("from_path, to_path, kind, specifier")
      .eq("analysis_id", id)
      .order("from_path")
      .order("to_path")
      .order("kind")
      .range(from, to),
  );
  if ("error" in edges) return edges;

  return {
    id: analysis.data.id,
    repository: analysis.data.repository,
    adapter: analysis.data.adapter ?? "none",
    imports: analysis.data.imports_seen ?? 0,
    coveragePercent: analysis.data.coverage_percent,
    files: files.rows.map((file) => ({
      path: file.path,
      folder: file.folder,
      lines: file.lines,
      hash: file.hash,
      fanIn: file.fan_in,
      fanOut: file.fan_out,
    })),
    edges: edges.rows.map((edge) => ({
      from: edge.from_path,
      to: edge.to_path,
      kind: importKind(edge.kind),
      specifier: edge.specifier,
    })),
  };
}

const PAGE = 1000;

async function eachPage<T>(
  load: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<{ rows: T[] } | { error: string }> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await load(from, from + PAGE - 1);
    if (error) return { error: error.message };
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE) return { rows };
  }
}

function importKind(value: string): ImportKind {
  if (value === "import" || value === "reexport" || value === "dynamic") return value;
  throw new Error(`Stored edge kind is not an import kind: ${value}`);
}
