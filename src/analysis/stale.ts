// A run that dies without writing a failure stays "running". A few minutes
// without a stage change is long enough to tell that apart from one that is
// still working.

const STALE_AFTER_MS = 3 * 60 * 1000;

export function isStale(state: string, updatedAt: string, now = Date.now()): boolean {
  if (state !== "running" && state !== "queued") return false;
  const updated = Date.parse(updatedAt);
  if (Number.isNaN(updated)) return false;
  return now - updated > STALE_AFTER_MS;
}
