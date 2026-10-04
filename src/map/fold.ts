import type { Edge, ParsedFile } from "../parser/types.ts";
import { compare } from "./order.ts";

// Two dozen nodes is the most the map will show before the threshold rises.
const NODE_CAP = 24;

export type FoldedNode = {
  path: string;
  files: ParsedFile[];
  fanIn: number;
  fanOut: number;
};

export type Fold = {
  threshold: number;
  nodes: FoldedNode[];
};

type Dir = {
  path: string;
  parent: string | null;
  depth: number;
};

// Every directory starts as its own node. From the deepest depth upward, a
// directory holding fewer than `threshold` files merges into its parent.
// Counts at one depth are read before any merge at that depth is applied, and
// each threshold is computed from the original directories. The threshold
// starts at a couple of files and rises until the node count is at most 24.
export function foldFiles(files: readonly ParsedFile[], edges: readonly Edge[]): Fold {
  if (files.length === 0) return { threshold: 2, nodes: [] };

  let threshold = 2;
  let groups = foldAt(files, threshold);
  while (groups.size > NODE_CAP && threshold < files.length) {
    threshold += 1;
    groups = foldAt(files, threshold);
  }

  const nodes = withDegrees(groups, edges);
  let held = 0;
  for (const node of nodes) held += node.files.length;
  if (held !== files.length) {
    throw new Error(`folding holds ${held} files of ${files.length}`);
  }
  return { threshold, nodes };
}

function foldAt(files: readonly ParsedFile[], threshold: number): Map<string, ParsedFile[]> {
  const { dirs, direct } = directories(files);
  const owned = new Map<string, ParsedFile[]>();
  for (const [folder, list] of direct) owned.set(folder, [...list]);
  const parentOf = new Map(dirs.map((dir) => [dir.path, dir.parent]));
  const maxDepth = dirs.reduce((max, dir) => Math.max(max, dir.depth), 0);
  const merged = new Set<string>();

  for (let depth = maxDepth; depth >= 1; depth -= 1) {
    const merging = dirs
      .filter((dir) => dir.depth === depth && (owned.get(dir.path)?.length ?? 0) < threshold)
      .sort((a, b) => compare(a.path, b.path));
    for (const dir of merging) {
      const parent = parentOf.get(dir.path);
      if (!parent) continue;
      const here = owned.get(dir.path) ?? [];
      const parentFiles = owned.get(parent) ?? [];
      owned.set(parent, parentFiles.concat(here));
      owned.set(dir.path, []);
      merged.add(dir.path);
    }
  }

  const groups = new Map<string, ParsedFile[]>();
  for (const dir of dirs) {
    if (merged.has(dir.path)) continue;
    const held = owned.get(dir.path) ?? [];
    if (held.length === 0) continue;
    held.sort((a, b) => compare(a.path, b.path));
    groups.set(dir.path, held);
  }
  return groups;
}

function directories(files: readonly ParsedFile[]): {
  dirs: Dir[];
  direct: Map<string, ParsedFile[]>;
} {
  const byPath = new Map<string, Dir>();
  const direct = new Map<string, ParsedFile[]>();

  const ensure = (folder: string): void => {
    if (byPath.has(folder)) return;
    const depth = folder === "." ? 0 : folder.split("/").length;
    const parent =
      folder === "." ? null : folder.includes("/") ? folder.slice(0, folder.lastIndexOf("/")) : ".";
    byPath.set(folder, { path: folder, parent, depth });
    direct.set(folder, []);
    if (parent) ensure(parent);
  };

  for (const file of files) {
    ensure(file.folder);
    const list = direct.get(file.folder);
    if (!list) throw new Error(`folder missing for ${file.path}`);
    list.push(file);
  }

  const dirs = [...byPath.values()].sort(
    (a, b) => a.depth - b.depth || compare(a.path, b.path),
  );
  return { dirs, direct };
}

function withDegrees(groups: Map<string, ParsedFile[]>, edges: readonly Edge[]): FoldedNode[] {
  const nodeOf = new Map<string, string>();
  for (const [folder, group] of groups) {
    for (const file of group) {
      if (nodeOf.has(file.path)) throw new Error(`file ${file.path} is in two nodes`);
      nodeOf.set(file.path, folder);
    }
  }

  const incoming = new Map<string, Set<string>>();
  const outgoing = new Map<string, Set<string>>();
  for (const folder of groups.keys()) {
    incoming.set(folder, new Set());
    outgoing.set(folder, new Set());
  }

  for (const edge of edges) {
    const from = nodeOf.get(edge.from);
    const to = nodeOf.get(edge.to);
    if (!from || !to) {
      throw new Error(`edge ${edge.from} -> ${edge.to} does not terminate on a node`);
    }
    if (from === to) continue;
    outgoing.get(from)?.add(edge.to);
    incoming.get(to)?.add(edge.from);
  }

  const nodes: FoldedNode[] = [];
  for (const [folder, group] of groups) {
    if (group.length < 2) {
      throw new Error(`node ${folder} holds ${String(group.length)} files`);
    }
    nodes.push({
      path: folder,
      files: group,
      fanIn: incoming.get(folder)?.size ?? 0,
      fanOut: outgoing.get(folder)?.size ?? 0,
    });
  }
  nodes.sort((a, b) => compare(a.path, b.path));
  return nodes;
}
