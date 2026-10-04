"use client";

import { useCallback, useRef, useState } from "react";
import type { Selection } from "@/map/scene";
import type { Edge, ParsedFile } from "@/parser/types";
import { CanvasShell } from "./canvas-shell";
import { DetailPane, type DetailTab } from "./detail-pane";
import { HighlightProvider } from "./map-highlight";
import { MapCanvas } from "./map-canvas";

export function MapSession({
  rail,
  files,
  edges,
  rootName,
  framework,
  imports,
  routes,
}: {
  rail: React.ReactNode;
  files: readonly ParsedFile[];
  edges: readonly Edge[];
  rootName: string;
  framework: string;
  imports: number;
  routes: number;
}) {
  const [selected, setSelected] = useState<Selection | null>(null);
  const [tab, setTab] = useState<DetailTab>("structure");
  const selectFileRef = useRef<(path: string) => void>(() => {});
  const onSelectFile = useCallback((path: string) => {
    selectFileRef.current(path);
  }, []);

  return (
    <HighlightProvider>
      <CanvasShell
        rail={rail}
        map={
          <MapCanvas
            files={files}
            edges={edges}
            rootName={rootName}
            selected={selected}
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
