import fs from "node:fs";
import { dedupeEdges, withFan } from "./graph.ts";
import {
  folderOf,
  type Counts,
  type Edge,
  type ExcludedDirectory,
  type ImportKind,
  type ImportSighting,
  type ImportStatus,
  type ParsedFile,
  type ParseResult,
  type SkippedFile,
} from "./types.ts";

const KINDS: readonly ImportKind[] = ["import", "reexport", "dynamic"];
const STATUSES: readonly ImportStatus[] = [
  "resolved",
  "external",
  "excluded",
  "unresolved",
];

export function writeResult(filePath: string, result: ParseResult): void {
  assertResult(result);
  fs.writeFileSync(filePath, `${JSON.stringify(result, null, 2)}\n`);
}

export function readResult(filePath: string): ParseResult {
  const text = fs.readFileSync(filePath, "utf8");
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Parse result is not JSON: ${message}`);
  }
  const result = resultFromUnknown(data);
  assertResult(result);
  return result;
}

export function assertResult(result: ParseResult): void {
  if (result.counts.found !== result.counts.parsed + result.counts.skipped) {
    throw new Error("files found is not parsed plus skipped");
  }
  if (result.counts.parsed !== result.files.length) {
    throw new Error("parsed count does not match the file list");
  }
  if (result.counts.skipped !== result.skipped.length) {
    throw new Error("skipped count does not match the skip list");
  }

  const paths = new Set<string>();
  for (const file of result.files) {
    if (paths.has(file.path)) throw new Error(`duplicate file ${file.path}`);
    paths.add(file.path);
    if (file.folder !== folderOf(file.path)) {
      throw new Error(`folder for ${file.path} is not its parent directory`);
    }
    if (!/^[a-f0-9]{64}$/.test(file.hash)) {
      throw new Error(`hash for ${file.path} is not sha256`);
    }
  }

  for (const file of result.skipped) {
    if (!file.reason) throw new Error(`skipped file ${file.path} has no reason`);
  }
  for (const directory of result.excludedDirectories) {
    if (!directory.reason) {
      throw new Error(`excluded directory ${directory.path} has no reason`);
    }
  }

  const edgeKeys = new Set<string>();
  for (const edge of result.edges) {
    if (!paths.has(edge.from) || !paths.has(edge.to)) {
      throw new Error(`edge ${edge.from} -> ${edge.to} does not join two parsed files`);
    }
    const key = `${edge.from}\0${edge.to}\0${edge.kind}`;
    if (edgeKeys.has(key)) throw new Error(`duplicate edge ${edge.from} -> ${edge.to}`);
    edgeKeys.add(key);
  }
  if (dedupeEdges(result.edges).length !== result.edges.length) {
    throw new Error("edge list still contains duplicates");
  }

  const recomputed = withFan(
    result.files.map((file) => ({
      path: file.path,
      folder: file.folder,
      lines: file.lines,
      hash: file.hash,
    })),
    result.edges,
  );
  for (let index = 0; index < recomputed.length; index++) {
    const expected = recomputed[index];
    const actual = result.files[index];
    if (!expected || !actual) throw new Error("fan-in check lost a file");
    if (expected.fanIn !== actual.fanIn || expected.fanOut !== actual.fanOut) {
      throw new Error(`fan-in or fan-out does not match the edge list for ${actual.path}`);
    }
  }

  for (const sighting of result.imports) {
    if (sighting.status === "resolved") {
      if (!sighting.to || !paths.has(sighting.to)) {
        throw new Error(`resolved import ${sighting.from} ${sighting.specifier} has no parsed target`);
      }
      const key = `${sighting.from}\0${sighting.to}\0${sighting.kind}`;
      if (!edgeKeys.has(key)) {
        throw new Error(`resolved import ${sighting.from} ${sighting.specifier} has no edge`);
      }
      continue;
    }
    if (sighting.to) {
      throw new Error(`unresolved import ${sighting.from} ${sighting.specifier} names a target`);
    }
    if (!sighting.reason) {
      throw new Error(`import ${sighting.from} ${sighting.specifier} has no reason`);
    }
  }

  for (const edge of result.edges) {
    const seen = result.imports.some(
      (sighting) =>
        sighting.status === "resolved" &&
        sighting.from === edge.from &&
        sighting.to === edge.to &&
        sighting.kind === edge.kind,
    );
    if (!seen) {
      throw new Error(`edge ${edge.from} -> ${edge.to} has no resolved import`);
    }
  }
}

function resultFromUnknown(data: unknown): ParseResult {
  const record = recordOf(data, "result");
  return {
    root: stringField(record, "root"),
    adapter: stringField(record, "adapter"),
    counts: countsFromUnknown(record.counts),
    files: arrayOf(record.files, "files", fileFromUnknown),
    edges: arrayOf(record.edges, "edges", edgeFromUnknown),
    skipped: arrayOf(record.skipped, "skipped", skippedFromUnknown),
    excludedDirectories: arrayOf(
      record.excludedDirectories,
      "excludedDirectories",
      excludedFromUnknown,
    ),
    imports: arrayOf(record.imports, "imports", sightingFromUnknown),
  };
}

function countsFromUnknown(data: unknown): Counts {
  const record = recordOf(data, "counts");
  return {
    found: numberField(record, "found"),
    parsed: numberField(record, "parsed"),
    skipped: numberField(record, "skipped"),
  };
}

function fileFromUnknown(data: unknown): ParsedFile {
  const record = recordOf(data, "file");
  return {
    path: stringField(record, "path"),
    folder: stringField(record, "folder"),
    lines: numberField(record, "lines"),
    hash: stringField(record, "hash"),
    fanIn: numberField(record, "fanIn"),
    fanOut: numberField(record, "fanOut"),
  };
}

function edgeFromUnknown(data: unknown): Edge {
  const record = recordOf(data, "edge");
  return {
    from: stringField(record, "from"),
    to: stringField(record, "to"),
    kind: kindField(record.kind),
    specifier: stringField(record, "specifier", true),
  };
}

function skippedFromUnknown(data: unknown): SkippedFile {
  const record = recordOf(data, "skipped file");
  return {
    path: stringField(record, "path"),
    reason: stringField(record, "reason"),
  };
}

function excludedFromUnknown(data: unknown): ExcludedDirectory {
  const record = recordOf(data, "excluded directory");
  return {
    path: stringField(record, "path"),
    reason: stringField(record, "reason"),
  };
}

function sightingFromUnknown(data: unknown): ImportSighting {
  const record = recordOf(data, "import");
  const status = statusField(record.status);
  const sighting: ImportSighting = {
    from: stringField(record, "from"),
    kind: kindField(record.kind),
    specifier: stringField(record, "specifier", true),
    status,
  };
  if (status === "resolved") {
    sighting.to = stringField(record, "to");
    return sighting;
  }
  sighting.reason = stringField(record, "reason");
  if ("to" in record && record.to !== undefined) {
    throw new Error("import names a target without resolving");
  }
  return sighting;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recordOf(data: unknown, label: string): Record<string, unknown> {
  if (!isRecord(data)) throw new Error(`${label} must be an object`);
  return data;
}

function arrayOf<T>(data: unknown, label: string, read: (value: unknown) => T): T[] {
  if (!Array.isArray(data)) throw new Error(`${label} must be an array`);
  return data.map(read);
}

function stringField(
  record: Record<string, unknown>,
  key: string,
  allowEmpty = false,
): string {
  const value = record[key];
  if (typeof value !== "string" || (!allowEmpty && value.length === 0)) {
    throw new Error(`${key} must be a string`);
  }
  return value;
}

function numberField(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`${key} must be a non-negative integer`);
  }
  return value;
}

function kindField(value: unknown): ImportKind {
  if (value === "import" || value === "reexport" || value === "dynamic") return value;
  throw new Error(`import kind must be one of ${KINDS.join(", ")}`);
}

function statusField(value: unknown): ImportStatus {
  if (
    value === "resolved" ||
    value === "external" ||
    value === "excluded" ||
    value === "unresolved"
  ) {
    return value;
  }
  throw new Error(`import status must be one of ${STATUSES.join(", ")}`);
}
