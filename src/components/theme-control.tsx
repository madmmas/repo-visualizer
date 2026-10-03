"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { setTheme } from "@/theme-action";
import { themes, type Theme } from "@/theme";

const labels: Record<Theme, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

export function ThemeControl({ theme }: { theme: Theme }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function choose(next: Theme) {
    setError(null);
    try {
      await setTheme(next);
      router.refresh();
    } catch {
      setError("Couldn't save the theme.");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center border border-border">
        {themes.map((option) => {
          const selected = theme === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                void choose(option);
              }}
              className={
                selected
                  ? "bg-accent px-2 py-1 text-xs text-white"
                  : "px-2 py-1 text-xs text-muted"
              }
            >
              {labels[option]}
            </button>
          );
        })}
      </div>
      {error ? <p className="text-xs text-foreground">{error}</p> : null}
    </div>
  );
}
