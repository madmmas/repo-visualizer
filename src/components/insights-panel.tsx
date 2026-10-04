"use client";

import { useMemo } from "react";
import { insights, type Insight } from "@/map/insights";
import type { Edge, ParsedFile } from "@/parser/types";
import { useHighlight } from "./map-highlight";

const lit = "bg-[color-mix(in_srgb,var(--accent)_16%,transparent)]";

export function InsightsPanel({
  files,
  edges,
  onSelectFile,
}: {
  files: readonly ParsedFile[];
  edges: readonly Edge[];
  onSelectFile: (path: string) => void;
}) {
  const found = useMemo(() => insights(files, edges), [files, edges]);
  return (
    <details className="border-t border-border">
      <summary className="cursor-pointer px-2 py-1 text-xs text-muted">Insights</summary>
      <div className="pb-2">
        {found.map((insight) => (
          <InsightBlock key={insight.id} insight={insight} onSelectFile={onSelectFile} />
        ))}
      </div>
    </details>
  );
}

function InsightBlock({
  insight,
  onSelectFile,
}: {
  insight: Insight;
  onSelectFile: (path: string) => void;
}) {
  const count =
    insight.id === "cycle"
      ? insight.groups.length
      : insight.groups.reduce((sum, group) => sum + group.length, 0);
  return (
    <section className="mt-2">
      <h3 className="px-2 text-pretty text-xs">{insight.sentence}</h3>
      <p className="px-2 tabular-nums text-xs text-muted">{count}</p>
      {insight.groups.map((group) => (
        <ol key={group.map((file) => file.path).join("\0")} className="mt-1">
          {group.map((file, index) => (
            <li key={`${file.path}:${index}`}>
              <FileButton
                path={file.path}
                count={file.count}
                index={insight.id === "cycle" ? index + 1 : undefined}
                onSelectFile={onSelectFile}
              />
            </li>
          ))}
        </ol>
      ))}
    </section>
  );
}

function FileButton({
  path,
  count,
  index,
  onSelectFile,
}: {
  path: string;
  count?: number;
  index?: number;
  onSelectFile: (path: string) => void;
}) {
  const { hovered, setHovered, clearHovered } = useHighlight();
  return (
    <button
      type="button"
      data-path={path}
      className={`flex w-full items-baseline gap-2 px-2 py-0.5 text-left font-mono text-xs break-all ${
        hovered === path ? lit : ""
      }`}
      onMouseEnter={() => setHovered(path)}
      onMouseLeave={() => clearHovered(path)}
      onClick={() => onSelectFile(path)}
    >
      {index !== undefined ? (
        <span className="shrink-0 tabular-nums text-muted">{index}</span>
      ) : null}
      {count !== undefined ? (
        <span className="shrink-0 tabular-nums text-muted">{count}</span>
      ) : null}
      <span className="min-w-0 break-all">{path}</span>
    </button>
  );
}
