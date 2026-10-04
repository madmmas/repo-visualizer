"use client";

import { useState } from "react";

// Collapsed, this is still one line, and that line still names the figure.
// A partial graph cannot be dismissed into looking finished.

export function CoverageBanner({ percent }: { percent: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="shrink-0 border-b border-border px-2 py-1 text-xs">
      <button
        type="button"
        className="text-left"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        Partial graph, {percent}% of imports resolved
      </button>
      {open ? (
        <p className="mt-1 max-w-xl text-pretty text-muted">
          {percent}% of the imports that should land in this repository became edges. The rest
          are unresolved, so those lines are not on the map.
        </p>
      ) : null}
    </div>
  );
}
