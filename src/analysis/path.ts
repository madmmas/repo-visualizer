export function analysisPath(id: number, state: string): string {
  if (state === "complete") return `/analyses/${id}/map`;
  return `/analyses/${id}`;
}
