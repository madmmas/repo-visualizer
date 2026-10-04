import fs from "node:fs";
import path from "node:path";
import type { ExcludedDirectory, SkippedFile } from "./types.ts";

const SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
]);

export type WalkedFile = {
  path: string;
  absolute: string;
};

export type Walk = {
  source: WalkedFile[];
  skipped: SkippedFile[];
  excludedDirectories: ExcludedDirectory[];
};

// Whole source directories, not a walk outward from entry points. The fallback
// adapter has no framework entry points, and a file nothing imports is still
// part of the map. Hidden, dependency, and build directories are left out as
// structure, not as a guess about which framework produced them.
export function walk(root: string, adapterExclusions: readonly string[]): Walk {
  const source: WalkedFile[] = [];
  const skipped: SkippedFile[] = [];
  const excludedDirectories: ExcludedDirectory[] = [];
  visit(root, root, adapterExclusions, source, skipped, excludedDirectories);
  source.sort((a, b) => compare(a.path, b.path));
  skipped.sort((a, b) => compare(a.path, b.path));
  excludedDirectories.sort((a, b) => compare(a.path, b.path));
  return { source, skipped, excludedDirectories };
}

function visit(
  root: string,
  directory: string,
  adapterExclusions: readonly string[],
  source: WalkedFile[],
  skipped: SkippedFile[],
  excludedDirectories: ExcludedDirectory[],
): void {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  entries.sort((a, b) => compare(a.name, b.name));
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    const relative = relativePosix(root, absolute);
    if (entry.isSymbolicLink()) {
      skipped.push({ path: relative, reason: "symbolic link" });
      continue;
    }
    if (entry.isDirectory()) {
      const reason =
        structuralDirectoryReason(entry.name) ??
        adapterDirectoryReason(relative, adapterExclusions);
      if (reason) {
        excludedDirectories.push({ path: relative, reason });
        continue;
      }
      visit(root, absolute, adapterExclusions, source, skipped, excludedDirectories);
      continue;
    }
    if (!entry.isFile()) {
      skipped.push({ path: relative, reason: "not a regular file" });
      continue;
    }
    const reason = fileSkipReason(entry.name);
    if (reason) {
      skipped.push({ path: relative, reason });
      continue;
    }
    source.push({ path: relative, absolute });
  }
}

function structuralDirectoryReason(name: string): string | undefined {
  if (name.startsWith(".")) return "hidden directory";
  if (name === "node_modules") return "dependency directory";
  if (
    name === "dist" ||
    name === "build" ||
    name === "out" ||
    name === "coverage"
  ) {
    return "build output";
  }
  return undefined;
}

function adapterDirectoryReason(
  relative: string,
  exclusions: readonly string[],
): string | undefined {
  for (const exclusion of exclusions) {
    if (relative === exclusion || relative.startsWith(`${exclusion}/`)) {
      return "excluded by adapter";
    }
  }
  return undefined;
}

function fileSkipReason(name: string): string | undefined {
  if (
    name.endsWith(".d.ts") ||
    name.endsWith(".d.mts") ||
    name.endsWith(".d.cts")
  ) {
    return "declaration file";
  }
  const extension = path.posix.extname(name);
  if (SOURCE_EXTENSIONS.has(extension)) return undefined;
  if (!extension) return "not a source file (no extension)";
  return `not a source file (${extension})`;
}

function relativePosix(root: string, absolute: string): string {
  const relative = path.relative(root, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Path escaped the repository: ${absolute}`);
  }
  return relative.split(path.sep).join("/");
}

function compare(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
