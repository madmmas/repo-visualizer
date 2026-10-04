// One channel per analysis. The database policy allows this shape and no other,
// so a publish to anything else never reaches a page.

export function analysisChannel(id: number): string {
  return `analysis:${id}`;
}

export function stageMessage(value: unknown): { stage: string; message: string } | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const body =
    typeof record.stage === "string" && typeof record.message === "string"
      ? record
      : record.payload;
  if (typeof body !== "object" || body === null) return null;
  const payload = body as Record<string, unknown>;
  if (typeof payload.stage !== "string" || typeof payload.message !== "string") return null;
  return { stage: payload.stage, message: payload.message };
}
