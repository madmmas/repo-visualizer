// Imports that resolved to a file in the repository, over those plus the ones
// that failed. Packages outside the repository, and imports the adapter
// excluded on purpose, are not holes in the graph. Under 95 the map is partial.

export const COMPLETE_AT = 95;

export function coveragePercent(resolved: number, unresolved: number): number {
  const considered = resolved + unresolved;
  if (considered === 0) return 100;
  return Math.floor((resolved * 100) / considered);
}

export function isPartial(percent: number): boolean {
  return percent < COMPLETE_AT;
}
