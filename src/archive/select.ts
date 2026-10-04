import fs from "node:fs";
import path from "node:path";

// A GitHub archive wraps the repository in one directory. That directory is the
// parse root. Anything else is reported rather than picked.

export function selectRoot(directory: string): string {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const directories = entries.filter(
    (entry) => entry.isDirectory() && entry.name !== "PaxHeader",
  );
  const files = entries.filter((entry) => entry.isFile());
  const root = directories[0];
  if (directories.length !== 1 || files.length !== 0 || !root) {
    throw new Error("The archive does not contain a single repository root.");
  }
  return path.join(directory, root.name);
}
