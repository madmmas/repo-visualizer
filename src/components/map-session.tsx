"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { categoriesOf } from "@/map/categories";
import type { Selection } from "@/map/scene";
import type { Edge, ParsedFile } from "@/parser/types";
import { CanvasShell } from "./canvas-shell";
import { CategoryRail } from "./category-rail";
import { DetailPane, type DetailTab } from "./detail-pane";
import { HighlightProvider } from "./map-highlight";
import { InsightsPanel } from "./insights-panel";
import { MapCanvas } from "./map-canvas";

export function MapSession({
  files,
  edges,
  rootName,
  framework,
  imports,
  routes,
}: {
  files: readonly ParsedFile[];
  edges: readonly Edge[];
  rootName: string;
  framework: string;
  imports: number;
  routes: number;
}) {
  const [selected, setSelected] = useState<Selection | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>("structure");
  const selectFileRef = useRef<(path: string) => void>(() => {});
  const onSelectFile = useCallback((path: string) => {
    selectFileRef.current(path);
  }, []);
  const categories = useMemo(() => categoriesOf(files), [files]);
  const toggleCategory = useCallback((id: string) => {
    setCategoryId((current) => (current === id ? null : id));
  }, []);

  return (
    <HighlightProvider>
      <CanvasShell
        rail={
          <>
            <CategoryRail categories={categories} active={categoryId} onToggle={toggleCategory} />
            <InsightsPanel files={files} edges={edges} onSelectFile={onSelectFile} />
          </>
        }
        map={
          <MapCanvas
            files={files}
            edges={edges}
            rootName={rootName}
            selected={selected}
            categoryId={categoryId}
            onSelect={setSelected}
            selectFileRef={selectFileRef}
          />
        }
        detail={
          <DetailPane
            name={rootName}
            framework={framework}
            files={files}
            edges={edges}
            imports={imports}
            routes={routes}
            selected={selected}
            tab={tab}
            onTab={setTab}
            onSelectFile={onSelectFile}
          />
        }
      />
    </HighlightProvider>
  );
}
