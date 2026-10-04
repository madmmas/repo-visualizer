import path from "node:path";
import { parseRepository } from "./parse.ts";
import { readResult, writeResult } from "./result.ts";
import type { ParseResult } from "./types.ts";

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}

function main(): void {
  const args = process.argv.slice(2);
  if (args[0] === "--read") {
    const file = args[1];
    if (!file || args.length !== 2) usage();
    printResult(readResult(path.resolve(file)));
    return;
  }

  let outFile: string | undefined;
  const positional: string[] = [];
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--out") {
      const next = args[index + 1];
      if (!next) usage();
      outFile = path.resolve(next);
      index++;
      continue;
    }
    positional.push(arg ?? "");
  }
  const directory = positional[0];
  if (!directory || positional.length !== 1) usage();

  const result = parseRepository(directory);
  if (outFile) {
    writeResult(outFile, result);
    const readBack = readResult(outFile);
    if (
      readBack.counts.found !== result.counts.found ||
      readBack.counts.parsed !== result.counts.parsed ||
      readBack.counts.skipped !== result.counts.skipped ||
      readBack.files.length !== result.files.length ||
      readBack.edges.length !== result.edges.length ||
      readBack.imports.length !== result.imports.length
    ) {
      throw new Error("reading the written result back did not match");
    }
  }
  printResult(result);
  if (outFile) console.log(`\nwrote ${outFile}`);
}

function usage(): never {
  throw new Error("Usage: parse <directory> [--out <file>] | parse --read <file>");
}

function printResult(result: ParseResult): void {
  const folders = new Set(result.files.map((file) => file.folder));
  const lines = [
    `root: ${result.root}`,
    `adapter: ${result.adapter}`,
    "",
    `files found: ${result.counts.found}`,
    `files parsed: ${result.counts.parsed}`,
    `files skipped: ${result.counts.skipped}`,
    `found = parsed + skipped: ${result.counts.found} = ${result.counts.parsed} + ${result.counts.skipped}`,
    `folders: ${folders.size}`,
    "",
    "skipped:",
    ...grouped(result.skipped.map((file) => file.reason)),
    ...result.skipped.map((file) => `  ${file.path} — ${file.reason}`),
    "",
    `excluded directories: ${result.excludedDirectories.length}`,
    ...result.excludedDirectories.map((directory) => `  ${directory.path} — ${directory.reason}`),
    "",
    `edges: ${result.edges.length}`,
    ...grouped(result.edges.map((edge) => edge.kind)),
    "",
    `imports seen: ${result.imports.length}`,
    ...grouped(result.imports.map((sighting) => sighting.status)),
    "",
    ...reexports(result),
    "",
    "unresolved:",
    ...listOrNone(
      result.imports.filter((sighting) => sighting.status === "unresolved"),
      (sighting) =>
        `  ${sighting.from} ${sighting.specifier} ${sighting.kind} — ${sighting.reason}`,
    ),
  ];
  console.log(lines.join("\n"));
}

function reexports(result: ParseResult): string[] {
  const found = result.imports.filter((sighting) => sighting.kind === "reexport");
  const resolved = found.filter((sighting) => sighting.status === "resolved");
  const gaps = found.filter((sighting) => sighting.status !== "resolved");
  return [
    `re-exports found: ${found.length}`,
    `re-exports resolved: ${resolved.length}`,
    "re-export gaps:",
    ...listOrNone(
      gaps,
      (sighting) =>
        `  ${sighting.from} ${sighting.specifier} — ${sighting.status}: ${sighting.reason}`,
    ),
  ];
}

function grouped(values: readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => compare(a[0], b[0]))
    .map(([name, count]) => `  ${count}  ${name}`);
}

function listOrNone<T>(items: readonly T[], format: (item: T) => string): string[] {
  if (items.length === 0) return ["  (none)"];
  return items.map(format);
}

function compare(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
