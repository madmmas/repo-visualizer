// This is the contract later phases read. Paths are relative and use "/".
// One source file is one module. `folder` is that file's parent directory,
// because a coarser grouping cannot be recovered afterwards.

export type ImportKind = "import" | "reexport" | "dynamic";

export type ImportStatus = "resolved" | "external" | "excluded" | "unresolved";

export type ParsedFile = {
  path: string;
  folder: string;
  lines: number;
  hash: string;
  fanIn: number;
  fanOut: number;
};

export type Edge = {
  from: string;
  to: string;
  kind: ImportKind;
  specifier: string;
};

export type SkippedFile = {
  path: string;
  reason: string;
};

export type ExcludedDirectory = {
  path: string;
  reason: string;
};

export type ImportSighting = {
  from: string;
  kind: ImportKind;
  specifier: string;
  status: ImportStatus;
  to?: string;
  reason?: string;
};

export type Counts = {
  found: number;
  parsed: number;
  skipped: number;
};

export type ParseResult = {
  root: string;
  adapter: string;
  counts: Counts;
  files: ParsedFile[];
  edges: Edge[];
  skipped: SkippedFile[];
  excludedDirectories: ExcludedDirectory[];
  imports: ImportSighting[];
};

export function folderOf(filePath: string): string {
  const slash = filePath.lastIndexOf("/");
  if (slash === -1) return ".";
  if (slash === 0) {
    throw new Error(`File path must be relative: ${filePath}`);
  }
  return filePath.slice(0, slash);
}
