import { compare } from "./order.ts";

// The parser does not classify files, and this phase has no framework adapter.
// The extension is the kind that is actually in the path.

const KINDS: Record<string, { name: string; color: string }> = {
  ".ts": { name: "TypeScript", color: "var(--kind-ts)" },
  ".tsx": { name: "TSX", color: "var(--kind-tsx)" },
  ".mts": { name: "TypeScript module", color: "var(--kind-mts)" },
  ".cts": { name: "TypeScript CommonJS", color: "var(--kind-cts)" },
  ".js": { name: "JavaScript", color: "var(--kind-js)" },
  ".jsx": { name: "JSX", color: "var(--kind-jsx)" },
  ".mjs": { name: "JavaScript module", color: "var(--kind-mjs)" },
  ".cjs": { name: "CommonJS", color: "var(--kind-cjs)" },
};

export type Category = {
  id: string;
  name: string;
  count: number;
  color: string;
};

export type FileKind = {
  id: string;
  name: string;
  color: string;
};

export function fileKind(filePath: string): FileKind {
  const dot = filePath.lastIndexOf(".");
  const extension = dot === -1 ? "" : filePath.slice(dot);
  const known = KINDS[extension];
  if (known) return { id: extension, ...known };
  const id = extension || "(none)";
  return { id, name: extension || "No extension", color: "var(--muted)" };
}

export function categoriesOf(files: readonly { path: string }[]): Category[] {
  const counts = new Map<string, Category>();
  for (const file of files) {
    const kind = fileKind(file.path);
    const existing = counts.get(kind.id);
    if (existing) {
      existing.count += 1;
      continue;
    }
    counts.set(kind.id, { ...kind, count: 1 });
  }
  return [...counts.values()].sort(
    (a, b) => b.count - a.count || compare(a.name, b.name),
  );
}
