import type { Edge, ParsedFile } from "../parser/types.ts";
import { fileKind } from "./categories.ts";
import { foldFiles, type FoldedNode } from "./fold.ts";
import { uniqueLabels } from "./labels.ts";
import { placeNodes } from "./layout.ts";
import { HEADER_H, ROW_H, ROW_LIMIT, textPx } from "./metrics.ts";

export type Selection =
  | { readonly kind: "node"; readonly path: string }
  | { readonly kind: "file"; readonly path: string };

export type SceneRow = {
  path: string;
  label: string;
  swatch: string;
  selected: boolean;
  dimmed: boolean;
};

export type SceneNode = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  fileCount: number;
  fanIn: number;
  fanOut: number;
  open: boolean;
  selected: boolean;
  dimmed: boolean;
  swatch: string | null;
  matches: number | null;
  matchColor: string | null;
  rows: SceneRow[];
  paths: string[];
  windowStart: number;
};

export type SceneEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
  tone: "incoming" | "outgoing" | "plain";
  dimmed: boolean;
};

export type Scene = {
  nodes: SceneNode[];
  edges: SceneEdge[];
};

export function buildScene(input: {
  files: readonly ParsedFile[];
  edges: readonly Edge[];
  rootName: string;
  open: readonly string[];
  selected: Selection | null;
  windows: Readonly<Record<string, number>>;
  categoryId: string | null;
}): Scene {
  const fold = foldFiles(input.files, input.edges);
  const open = new Set(input.open);

  const labelIds: string[] = [];
  const labelText = new Map<string, string>();
  for (const node of fold.nodes) {
    labelIds.push(node.path);
    labelText.set(node.path, node.path === "." ? input.rootName : node.path);
    if (!open.has(node.path)) continue;
    for (const file of node.files) {
      labelIds.push(file.path);
      labelText.set(file.path, file.path);
    }
  }
  const labels = uniqueLabels(labelIds, (id) => labelText.get(id) ?? id);

  const nodeOf = new Map<string, string>();
  const filesOf = new Map<string, Set<string>>();
  for (const node of fold.nodes) {
    const paths = new Set<string>();
    for (const file of node.files) {
      nodeOf.set(file.path, node.path);
      paths.add(file.path);
    }
    filesOf.set(node.path, paths);
  }

  const lit = litSets(input.selected, input.edges, filesOf, nodeOf);
  const categoryFiles = filesInCategory(input.files, input.categoryId);
  const matchColor =
    input.categoryId === null ? null : fileKind(swatchPath(input.categoryId)).color;
  const sizes = fold.nodes.map((node) => {
    const isOpen = open.has(node.path);
    const start = isOpen ? clampWindow(input.windows[node.path] ?? 0, node.files.length) : 0;
    return { node, isOpen, start, ...nodeSize(node, labels, isOpen) };
  });

  // Edges attach to the files inside the scroll window. The rest meet the panel.
  const visibleFiles = new Map<string, ParsedFile[]>();
  for (const item of sizes) {
    if (!item.isOpen) continue;
    visibleFiles.set(item.node.path, item.node.files.slice(item.start, item.start + ROW_LIMIT));
  }

  const positions = placeNodes(
    sizes.map((item) => ({ id: item.node.path, width: item.width, height: item.height })),
    layoutEdges(input.edges, nodeOf),
  );

  const nodes: SceneNode[] = sizes.map((item) => {
    const position = positions.get(item.node.path);
    if (!position) throw new Error(`layout missed ${item.node.path}`);
    const swatch = sharedSwatch(item.node.files);
    const selectedNode = input.selected?.kind === "node" && input.selected.path === item.node.path;
    const matches = categoryFiles === null ? null : countMatches(item.node.files, categoryFiles);
    return {
      id: item.node.path,
      x: position.x,
      y: position.y,
      width: item.width,
      height: item.height,
      label: labels.get(item.node.path) ?? item.node.path,
      fileCount: item.node.files.length,
      fanIn: item.node.fanIn,
      fanOut: item.node.fanOut,
      open: open.has(item.node.path),
      selected: selectedNode,
      dimmed:
        (lit.nodes !== null && !lit.nodes.has(item.node.path)) ||
        (matches !== null && matches === 0),
      swatch,
      matches,
      matchColor,
      paths: item.node.files.map((file) => file.path),
      windowStart: item.start,
      rows: item.isOpen
        ? item.node.files.map((file) => ({
            path: file.path,
            label: labels.get(file.path) ?? file.path,
            swatch: fileKind(file.path).color,
            selected: input.selected?.kind === "file" && input.selected.path === file.path,
            dimmed:
              (lit.files !== null && !lit.files.has(file.path)) ||
              (categoryFiles !== null && !categoryFiles.has(file.path)),
          }))
        : [],
    };
  });

  return {
    nodes,
    edges: sceneEdges(
      input.edges,
      input.selected,
      filesOf,
      nodeOf,
      open,
      visibleFiles,
      categoryFiles,
    ),
  };
}

function nodeSize(
  node: FoldedNode,
  labels: Map<string, string>,
  isOpen: boolean,
): { width: number; height: number } {
  const label = labels.get(node.path) ?? node.path;
  const swatch = sharedSwatch(node.files);
  if (!isOpen) return collapsedSize(label, node.fanIn, swatch !== null);
  const header = `${label} ${String(node.files.length)} in ${String(node.fanIn)} out ${String(node.fanOut)}`;
  let width = textPx(header) + 56;
  for (const file of node.files) {
    width = Math.max(width, textPx(labels.get(file.path) ?? file.path) + 44);
  }
  if (node.files.length > ROW_LIMIT) width += 14;
  const shown = Math.min(node.files.length, ROW_LIMIT);
  const height = HEADER_H + shown * ROW_H;
  return { width: Math.max(width, 120), height };
}

function clampWindow(start: number, count: number): number {
  const max = Math.max(0, count - ROW_LIMIT);
  if (!Number.isFinite(start) || start <= 0) return 0;
  return Math.min(Math.floor(start), max);
}

function collapsedSize(label: string, fanIn: number, swatch: boolean): { width: number; height: number } {
  const width = Math.max(88, textPx(label) + (swatch ? 18 : 0) + 16);
  const height = Math.min(220, 28 + fanIn);
  return { width, height };
}

function sharedSwatch(files: readonly ParsedFile[]): string | null {
  const first = files[0];
  if (!first) return null;
  const color = fileKind(first.path).color;
  for (const file of files) {
    if (fileKind(file.path).color !== color) return null;
  }
  return color;
}

function layoutEdges(
  edges: readonly Edge[],
  nodeOf: Map<string, string>,
): { source: string; target: string }[] {
  const pairs: { source: string; target: string }[] = [];
  for (const edge of edges) {
    const source = nodeOf.get(edge.from);
    const target = nodeOf.get(edge.to);
    if (!source || !target || source === target) continue;
    pairs.push({ source, target });
  }
  return pairs;
}

function litSets(
  selected: Selection | null,
  edges: readonly Edge[],
  filesOf: Map<string, Set<string>>,
  nodeOf: Map<string, string>,
): { nodes: Set<string> | null; files: Set<string> | null } {
  if (!selected) return { nodes: null, files: null };

  const seeds = new Set<string>();
  if (selected.kind === "file") {
    seeds.add(selected.path);
  } else {
    const files = filesOf.get(selected.path);
    if (files) for (const file of files) seeds.add(file);
  }

  const litFiles = new Set(seeds);
  for (const edge of edges) {
    if (!seeds.has(edge.from) && !seeds.has(edge.to)) continue;
    litFiles.add(edge.from);
    litFiles.add(edge.to);
  }

  const litNodes = new Set<string>();
  for (const file of litFiles) {
    const node = nodeOf.get(file);
    if (node) litNodes.add(node);
  }
  if (selected.kind === "node") litNodes.add(selected.path);
  return { nodes: litNodes, files: litFiles };
}

function filesInCategory(
  files: readonly ParsedFile[],
  categoryId: string | null,
): Set<string> | null {
  if (categoryId === null) return null;
  const matched = new Set<string>();
  for (const file of files) {
    if (fileKind(file.path).id === categoryId) matched.add(file.path);
  }
  return matched;
}

function swatchPath(categoryId: string): string {
  return categoryId === "(none)" ? "file" : `file${categoryId}`;
}

function countMatches(files: readonly ParsedFile[], matched: Set<string>): number {
  let count = 0;
  for (const file of files) {
    if (matched.has(file.path)) count += 1;
  }
  return count;
}

function sceneEdges(
  edges: readonly Edge[],
  selected: Selection | null,
  filesOf: Map<string, Set<string>>,
  nodeOf: Map<string, string>,
  open: Set<string>,
  visibleFiles: Map<string, ParsedFile[]>,
  categoryFiles: Set<string> | null,
): SceneEdge[] {
  const selectedFiles =
    selected?.kind === "node" ? (filesOf.get(selected.path) ?? new Set<string>()) : null;
  const visible = new Set<string>();
  for (const files of visibleFiles.values()) {
    for (const file of files) visible.add(file.path);
  }

  const drawn = new Map<string, SceneEdge>();
  for (const edge of edges) {
    const source = endpoint(edge.from, "out", nodeOf, open, visible);
    const target = endpoint(edge.to, "in", nodeOf, open, visible);
    if (!source || !target) continue;
    if (source.nodeId === target.nodeId) {
      const collapsed = source.handle === "out" && target.handle === "in";
      const bothHidden = source.handle === "out:overflow" && target.handle === "in:overflow";
      if (collapsed || bothHidden) continue;
    }
    const tone = edgeTone(edge, selected, selectedFiles);
    const onSelection =
      selected !== null &&
      (selected.kind === "file"
        ? edge.from === selected.path || edge.to === selected.path
        : (selectedFiles?.has(edge.from) ?? false) || (selectedFiles?.has(edge.to) ?? false));
    const inCategory =
      categoryFiles !== null &&
      categoryFiles.has(edge.from) &&
      categoryFiles.has(edge.to);
    const dimmed = (selected !== null && !onSelection) || (categoryFiles !== null && !inCategory);
    const id = `${source.nodeId}|${source.handle}|${target.nodeId}|${target.handle}|${tone}|${dimmed ? "dim" : "lit"}`;
    if (drawn.has(id)) continue;
    drawn.set(id, {
      id,
      source: source.nodeId,
      target: target.nodeId,
      sourceHandle: source.handle,
      targetHandle: target.handle,
      tone,
      dimmed,
    });
  }
  return [...drawn.values()];
}

function endpoint(
  filePath: string,
  side: "in" | "out",
  nodeOf: Map<string, string>,
  open: Set<string>,
  visible: Set<string>,
): { nodeId: string; handle: string } | null {
  const nodeId = nodeOf.get(filePath);
  if (!nodeId) return null;
  if (!open.has(nodeId)) return { nodeId, handle: side };
  if (visible.has(filePath)) return { nodeId, handle: `${side}:${filePath}` };
  return { nodeId, handle: `${side}:overflow` };
}

function edgeTone(
  edge: Edge,
  selected: Selection | null,
  selectedFiles: Set<string> | null,
): "incoming" | "outgoing" | "plain" {
  if (!selected) return "plain";
  if (selected.kind === "file") {
    if (edge.to === selected.path && edge.from !== selected.path) return "incoming";
    if (edge.from === selected.path && edge.to !== selected.path) return "outgoing";
    return "plain";
  }
  if (!selectedFiles) return "plain";
  const fromIn = selectedFiles.has(edge.from);
  const toIn = selectedFiles.has(edge.to);
  if (toIn && !fromIn) return "incoming";
  if (fromIn && !toIn) return "outgoing";
  return "plain";
}
