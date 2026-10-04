"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type Highlight = {
  hovered: string | null;
  setHovered: (path: string) => void;
  clearHovered: (path: string) => void;
};

const HighlightContext = createContext<Highlight | null>(null);

export function HighlightProvider({ children }: { children: React.ReactNode }) {
  const [hovered, setHoveredState] = useState<string | null>(null);
  const setHovered = useCallback((path: string) => {
    setHoveredState(path);
  }, []);
  const clearHovered = useCallback((path: string) => {
    setHoveredState((current) => (current === path ? null : current));
  }, []);
  const value = useMemo(
    () => ({ hovered, setHovered, clearHovered }),
    [hovered, setHovered, clearHovered],
  );
  return <HighlightContext.Provider value={value}>{children}</HighlightContext.Provider>;
}

export function useHighlight(): Highlight {
  const highlight = useContext(HighlightContext);
  if (!highlight) throw new Error("Highlight state is missing");
  return highlight;
}
