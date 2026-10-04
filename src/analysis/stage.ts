export const STAGES = ["fetch", "select", "parse", "store"] as const;

export type Stage = (typeof STAGES)[number];

export function isStage(value: string): value is Stage {
  return value === "fetch" || value === "select" || value === "parse" || value === "store";
}
