import { compare } from "./order.ts";

export type WalkDirection = "dependents" | "dependencies";

// Two levels is the answer. Another level is most of the repository.
export const WALK_DEPTH = 2;

// Dependents: what breaks if this file changes, walking edges backward.
// Dependencies: what this file needs, walking edges forward.
// Each array is one step out from the file. The first is one step away.
export function walkFrom(
  edges: readonly { from: string; to: string }[],
  start: string,
  direction: WalkDirection,
  depth = WALK_DEPTH,
): string[][] {
  if (depth < 1) return [];
  const next = new Map<string, Set<string>>();
  for (const edge of edges) {
    const from = direction === "dependencies" ? edge.from : edge.to;
    const to = direction === "dependencies" ? edge.to : edge.from;
    let targets = next.get(from);
    if (!targets) {
      targets = new Set();
      next.set(from, targets);
    }
    targets.add(to);
  }

  const seen = new Set<string>([start]);
  const steps: string[][] = [];
  let frontier = [start];
  for (let level = 0; level < depth; level += 1) {
    const upcoming: string[] = [];
    for (const node of frontier) {
      for (const target of next.get(node) ?? []) {
        if (seen.has(target)) continue;
        seen.add(target);
        upcoming.push(target);
      }
    }
    if (upcoming.length === 0) break;
    upcoming.sort(compare);
    steps.push(upcoming);
    frontier = upcoming;
  }
  return steps;
}
