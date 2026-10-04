import { Graph, layout } from "@dagrejs/dagre";
import { compare } from "./order.ts";

export type SizedNode = {
  id: string;
  width: number;
  height: number;
};

export type LayoutEdge = {
  source: string;
  target: string;
};

// network-simplex on nodes and edges inserted in sorted order. Same input, same picture.
export function placeNodes(
  nodes: readonly SizedNode[],
  edges: readonly LayoutEdge[],
): Map<string, { x: number; y: number }> {
  const graph = new Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: "LR",
    nodesep: 8,
    ranksep: 12,
    edgesep: 8,
    marginx: 8,
    marginy: 8,
    ranker: "network-simplex",
  });

  const orderedNodes = [...nodes].sort((a, b) => compare(a.id, b.id));
  for (const node of orderedNodes) {
    graph.setNode(node.id, { width: node.width, height: node.height });
  }

  const seen = new Set<string>();
  const orderedEdges = [...edges].sort(
    (a, b) => compare(a.source, b.source) || compare(a.target, b.target),
  );
  for (const edge of orderedEdges) {
    if (edge.source === edge.target) continue;
    const key = `${edge.source}\0${edge.target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    graph.setEdge(edge.source, edge.target);
  }

  layout(graph);

  const positions = new Map<string, { x: number; y: number }>();
  for (const node of orderedNodes) {
    const placed = positioned(graph.node(node.id));
    positions.set(node.id, {
      x: placed.x - node.width / 2,
      y: placed.y - node.height / 2,
    });
  }
  return positions;
}

function positioned(value: unknown): { x: number; y: number } {
  if (
    typeof value === "object" &&
    value !== null &&
    "x" in value &&
    "y" in value &&
    typeof value.x === "number" &&
    typeof value.y === "number"
  ) {
    return { x: value.x, y: value.y };
  }
  throw new Error("layout did not position a node");
}
