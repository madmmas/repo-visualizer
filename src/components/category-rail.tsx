"use client";

import type { Category } from "@/map/categories";

const lit = "bg-[color-mix(in_srgb,var(--accent)_16%,transparent)]";

export function CategoryRail({
  categories,
  active,
  onToggle,
}: {
  categories: readonly Category[];
  active: string | null;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="py-2">
      <h2 className="px-2 pb-1 text-xs text-muted">Categories</h2>
      <ul>
        {categories.map((category) => {
          const pressed = active === category.id;
          return (
            <li key={category.id}>
              <button
                type="button"
                aria-pressed={pressed}
                className={`flex w-full items-center gap-2 px-2 py-0.5 text-left text-xs ${pressed ? lit : ""}`}
                onClick={() => onToggle(category.id)}
              >
                <span
                  className="size-2 shrink-0"
                  style={{ backgroundColor: category.color }}
                  aria-hidden
                />
                <span className="min-w-0 truncate">{category.name}</span>
                <span className="ml-auto pl-2 tabular-nums text-muted">{category.count}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
