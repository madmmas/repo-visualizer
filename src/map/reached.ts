// Pages, routes, layouts, middleware and config are loaded by name. The import
// graph never had a way to reach them, so a fan-in of zero is not a finding.

const SOURCE_EXT = /\.(tsx|ts|jsx|js|mts|cts|mjs|cjs)$/;

const ROLES = new Set(["page", "route", "layout", "middleware"]);

export function reachedBy(filePath: string): string {
  const name = filePath.slice(filePath.lastIndexOf("/") + 1);
  if (name.includes(".config.")) return "config";
  const stem = name.replace(SOURCE_EXT, "");
  if (ROLES.has(stem)) return stem;
  const segments = filePath.split("/");
  segments.pop();
  if (segments.includes("pages")) return "page";
  return "imports only";
}
