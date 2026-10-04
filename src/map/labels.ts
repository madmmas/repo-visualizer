import { compare } from "./order.ts";

// Shortest suffix that no other visible path also displays.
export function uniqueLabels(
  ids: readonly string[],
  textOf: (id: string) => string,
): Map<string, string> {
  const ordered = [...ids].sort(compare);
  const parts = new Map<string, string[]>();
  for (const id of ordered) {
    parts.set(
      id,
      textOf(id)
        .split("/")
        .filter((part) => part.length > 0),
    );
  }
  const length = new Map<string, number>(ordered.map((id) => [id, 1]));

  const labelOf = (id: string): string => {
    const segments = parts.get(id) ?? [];
    if (segments.length === 0) return textOf(id);
    const used = Math.min(length.get(id) ?? 1, segments.length);
    return segments.slice(segments.length - used).join("/");
  };

  let grown = true;
  while (grown) {
    grown = false;
    const groups = new Map<string, string[]>();
    for (const id of ordered) {
      const label = labelOf(id);
      const group = groups.get(label);
      if (group) group.push(id);
      else groups.set(label, [id]);
    }
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      for (const id of group) {
        const segments = parts.get(id) ?? [];
        const current = length.get(id) ?? 1;
        if (current < segments.length) {
          length.set(id, current + 1);
          grown = true;
        }
      }
    }
  }

  const labels = new Map<string, string>();
  const owners = new Map<string, string>();
  for (const id of ordered) {
    let label = labelOf(id);
    if (owners.has(label)) label = textOf(id);
    const owner = owners.get(label);
    if (owner !== undefined) {
      labels.set(owner, textOf(owner));
      label = textOf(id);
    }
    owners.set(label, id);
    labels.set(id, label);
  }
  return labels;
}
