import type { Category } from "@/map/categories";

export function CategoryRail({ categories }: { categories: readonly Category[] }) {
  return (
    <div className="py-2">
      <h2 className="px-2 pb-1 text-xs text-muted">Categories</h2>
      <ul>
        {categories.map((category) => (
          <li key={category.id} className="flex items-center gap-2 px-2 py-0.5 text-xs">
            <span
              className="size-2 shrink-0"
              style={{ backgroundColor: category.color }}
              aria-hidden
            />
            <span className="min-w-0 truncate">{category.name}</span>
            <span className="ml-auto pl-2 tabular-nums text-muted">{category.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
