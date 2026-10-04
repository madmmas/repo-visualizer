import type { Edge, ParsedFile } from "../parser/types.ts";
import { compare } from "./order.ts";
import { reachedBy } from "./reached.ts";

export type InsightFile = {
  path: string;
  count?: number;
};

export type Insight = {
  id: "unimported" | "imported" | "cycle" | "long";
  sentence: string;
  groups: InsightFile[][];
};

// Longer than this is the whole criterion. The sentence states it.
const LONG_LINES = 500;

export function insights(
  files: readonly ParsedFile[],
  edges: readonly Edge[],
): Insight[] {
  return [
    {
      id: "unimported",
      sentence: "Nothing in the repository imports these files.",
      groups: [unimported(files)],
    },
    {
      id: "imported",
      sentence: "These files are imported by more than three times the median of files something imports.",
      groups: [heavilyImported(files)],
    },
    {
      id: "cycle",
      sentence: "These files import each other in a cycle.",
      groups: cycles(edges),
    },
    {
      id: "long",
      sentence: "These files are longer than 500 lines.",
      groups: [tooLong(files)],
    },
  ];
}

function unimported(files: readonly ParsedFile[]): InsightFile[] {
  return files
    .filter((file) => file.fanIn === 0 && reachedBy(file.path) === "imports only")
    .map((file) => ({ path: file.path }))
    .sort((a, b) => compare(a.path, b.path));
}

function heavilyImported(files: readonly ParsedFile[]): InsightFile[] {
  const median = medianImported(files);
  if (median === null) return [];
  const threshold = median * 3;
  return files
    .filter((file) => file.fanIn > threshold)
    .sort((a, b) => b.fanIn - a.fanIn || compare(a.path, b.path))
    .map((file) => ({ path: file.path, count: file.fanIn }));
}

function tooLong(files: readonly ParsedFile[]): InsightFile[] {
  return files
    .filter((file) => file.lines > LONG_LINES)
    .sort((a, b) => b.lines - a.lines || compare(a.path, b.path))
    .map((file) => ({ path: file.path, count: file.lines }));
}

function medianImported(files: readonly ParsedFile[]): number | null {
  const values = files
    .map((file) => file.fanIn)
    .filter((fanIn) => fanIn > 0)
    .sort((a, b) => a - b);
  if (values.length === 0) return null;
  const mid = Math.floor(values.length / 2);
  const upper = values[mid];
  if (upper === undefined) return null;
  if (values.length % 2 === 1) return upper;
  const lower = values[mid - 1];
  if (lower === undefined) return upper;
  return Math.floor((lower + upper) / 2);
}

function cycles(edges: readonly Edge[]): InsightFile[][] {
  const nodes = new Set<string>();
  const outgoing = new Map<string, Set<string>>();
  for (const edge of edges) {
    nodes.add(edge.from);
    nodes.add(edge.to);
    let targets = outgoing.get(edge.from);
    if (!targets) {
      targets = new Set();
      outgoing.set(edge.from, targets);
    }
    targets.add(edge.to);
  }
  const ordered = new Map<string, string[]>();
  for (const [node, targets] of outgoing) {
    ordered.set(node, [...targets].sort(compare));
  }
  const names = [...nodes].sort(compare);
  return stronglyConnected(names, ordered)
    .filter((component) => hasCycle(component, ordered))
    .map((component) => shortestCycle(component, ordered))
    .sort((a, b) => a.length - b.length || compare(a.join("\0"), b.join("\0")))
    .map((cycle) => cycle.map((path) => ({ path })));
}

function hasCycle(component: readonly string[], outgoing: Map<string, string[]>): boolean {
  if (component.length > 1) return true;
  const only = component[0];
  if (!only) return false;
  return (outgoing.get(only) ?? []).includes(only);
}

// Iterative. A repository-sized component will blow a recursive search.
function stronglyConnected(
  nodes: readonly string[],
  outgoing: Map<string, readonly string[]>,
): string[][] {
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  let current = 0;
  const components: string[][] = [];

  for (const start of nodes) {
    if (index.has(start)) continue;
    const frames: { node: string; neighbor: number }[] = [{ node: start, neighbor: 0 }];
    index.set(start, current);
    low.set(start, current);
    current += 1;
    stack.push(start);
    onStack.add(start);

    while (frames.length > 0) {
      const frame = frames[frames.length - 1];
      if (!frame) break;
      const neighbors = outgoing.get(frame.node) ?? [];
      if (frame.neighbor < neighbors.length) {
        const next = neighbors[frame.neighbor];
        frame.neighbor += 1;
        if (next === undefined) continue;
        const seen = index.get(next);
        if (seen === undefined) {
          index.set(next, current);
          low.set(next, current);
          current += 1;
          stack.push(next);
          onStack.add(next);
          frames.push({ node: next, neighbor: 0 });
        } else if (onStack.has(next)) {
          low.set(frame.node, Math.min(low.get(frame.node) ?? seen, seen));
        }
        continue;
      }

      frames.pop();
      if (low.get(frame.node) === index.get(frame.node)) {
        const component: string[] = [];
        let popped: string | undefined;
        do {
          popped = stack.pop();
          if (popped === undefined) break;
          onStack.delete(popped);
          component.push(popped);
        } while (popped !== frame.node);
        components.push(component);
      }
      const parent = frames[frames.length - 1];
      if (!parent) continue;
      const parentLow = low.get(parent.node);
      const childLow = low.get(frame.node);
      if (parentLow === undefined || childLow === undefined) continue;
      low.set(parent.node, Math.min(parentLow, childLow));
    }
  }
  return components;
}

function shortestCycle(
  component: readonly string[],
  outgoing: Map<string, readonly string[]>,
): string[] {
  const allowed = new Set(component);
  let best: string[] | null = null;
  const starts = [...component].sort(compare);
  for (const start of starts) {
    const parent = new Map<string, string | null>();
    parent.set(start, null);
    const queue = [start];
    let head = 0;
    let found: string[] | null = null;
    while (head < queue.length) {
      const node = queue[head];
      head += 1;
      if (node === undefined) break;
      for (const next of outgoing.get(node) ?? []) {
        if (!allowed.has(next)) continue;
        if (next === start) {
          const path: string[] = [];
          let cursor: string | null = node;
          while (cursor !== null && cursor !== start) {
            path.push(cursor);
            cursor = parent.get(cursor) ?? null;
          }
          path.reverse();
          found = [start, ...path];
          break;
        }
        if (parent.has(next)) continue;
        parent.set(next, node);
        queue.push(next);
      }
      if (found) break;
    }
    if (!found) continue;
    const foundKey = found.join("\0");
    const bestKey = best?.join("\0");
    if (
      !best ||
      found.length < best.length ||
      (found.length === best.length && bestKey !== undefined && foundKey < bestKey)
    ) {
      best = found;
    }
  }
  if (!best) throw new Error("connected component contained no cycle");
  return best;
}
