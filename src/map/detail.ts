import type { Edge, ParsedFile } from "../parser/types.ts";
import { categoriesOf, fileKind, type Category, type FileKind } from "./categories.ts";
import { foldFiles } from "./fold.ts";
import { compare } from "./order.ts";

export type CountedPath = {
  path: string;
  count: number;
};

export type RepoSummary = {
  name: string;
  framework: string;
  files: number;
  imports: number;
  routes: number;
  unidentified: number;
  leanedOn: CountedPath[];
  unread: string[];
};

export type FileDetail = {
  path: string;
  kind: FileKind;
  lines: number;
  dependsOn: string[];
  dependedOnBy: string[];
};

export type FolderDetail = {
  path: string;
  fileCount: number;
  kinds: Category[];
};

// A convention names a file or it does not. Callers pass the files one named.
// None run in this phase, so the set is empty and every file is unidentified.
export function unidentifiedCount(
  files: readonly { path: string }[],
  identified: ReadonlySet<string> = new Set(),
): number {
  let count = 0;
  for (const file of files) {
    if (!identified.has(file.path)) count += 1;
  }
  return count;
}

export function repoSummary(input: {
  name: string;
  framework: string;
  files: readonly ParsedFile[];
  imports: number;
  routes: number;
  identified?: ReadonlySet<string>;
}): RepoSummary {
  const leanedOn = input.files
    .filter((file) => file.fanIn > 0)
    .sort((a, b) => b.fanIn - a.fanIn || compare(a.path, b.path))
    .map((file) => ({ path: file.path, count: file.fanIn }));
  const unread = input.files
    .filter((file) => file.fanIn === 0)
    .map((file) => file.path)
    .sort(compare);
  return {
    name: input.name,
    framework: input.framework,
    files: input.files.length,
    imports: input.imports,
    routes: input.routes,
    unidentified: unidentifiedCount(input.files, input.identified),
    leanedOn,
    unread,
  };
}

export function fileDetail(
  files: readonly ParsedFile[],
  edges: readonly Edge[],
  path: string,
): FileDetail | null {
  const file = files.find((item) => item.path === path);
  if (!file) return null;
  const depends = new Set<string>();
  const depended = new Set<string>();
  for (const edge of edges) {
    if (edge.from === path) depends.add(edge.to);
    if (edge.to === path) depended.add(edge.from);
  }
  const dependsOn = [...depends].sort(compare);
  const dependedOnBy = [...depended].sort(compare);
  if (dependsOn.length !== file.fanOut || dependedOnBy.length !== file.fanIn) {
    throw new Error(`neighbour lists do not match fan-in or fan-out for ${path}`);
  }
  return {
    path,
    kind: fileKind(path),
    lines: file.lines,
    dependsOn,
    dependedOnBy,
  };
}

export function folderDetail(
  files: readonly ParsedFile[],
  edges: readonly Edge[],
  path: string,
): FolderDetail | null {
  const node = foldFiles(files, edges).nodes.find((item) => item.path === path);
  if (!node) return null;
  const kinds = categoriesOf(node.files);
  const counted = kinds.reduce((sum, kind) => sum + kind.count, 0);
  if (counted !== node.files.length) {
    throw new Error(`kind counts do not cover ${path}`);
  }
  return { path, fileCount: node.files.length, kinds };
}
