import type { Edge, ParsedFile } from "./types.ts";

export type FileFacts = Omit<ParsedFile, "fanIn" | "fanOut">;

// Same source, target, and kind is one edge. Fan-in and fan-out then count
// distinct files, so an import and a re-export of the same target stay two
// edges but move the degree by one.
export function dedupeEdges(edges: readonly Edge[]): Edge[] {
  const seen = new Set<string>();
  const unique: Edge[] = [];
  for (const edge of edges) {
    const key = `${edge.from}\0${edge.to}\0${edge.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(edge);
  }
  return unique;
}

export function withFan(
  files: readonly FileFacts[],
  edges: readonly Edge[],
): ParsedFile[] {
  const incoming = new Map<string, Set<string>>();
  const outgoing = new Map<string, Set<string>>();
  for (const file of files) {
    incoming.set(file.path, new Set());
    outgoing.set(file.path, new Set());
  }
  for (const edge of edges) {
    outgoing.get(edge.from)?.add(edge.to);
    incoming.get(edge.to)?.add(edge.from);
  }
  return files.map((file) => ({
    ...file,
    fanIn: incoming.get(file.path)?.size ?? 0,
    fanOut: outgoing.get(file.path)?.size ?? 0,
  }));
}
