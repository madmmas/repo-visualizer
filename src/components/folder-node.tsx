"use client";

import { Handle, Position, useUpdateNodeInternals, type Node, type NodeProps } from "@xyflow/react";
import { useLayoutEffect, useRef } from "react";
import { HEADER_H, ROW_H, ROW_LIMIT } from "@/map/metrics";
import type { SceneRow } from "@/map/scene";
import { useMapActions } from "./map-actions";
import { useHighlight } from "./map-highlight";

export type FolderNodeData = {
  path: string;
  label: string;
  fileCount: number;
  fanIn: number;
  fanOut: number;
  open: boolean;
  selected: boolean;
  dimmed: boolean;
  swatch: string | null;
  matches: number | null;
  matchColor: string | null;
  rows: SceneRow[];
  paths: string[];
  windowStart: number;
};

export type FolderFlowNode = Node<FolderNodeData, "folder">;

const handleClass = "!size-px !min-h-0 !min-w-0 !border-0 !bg-transparent !opacity-0";

function MatchCount({ matches, color }: { matches: number | null; color: string | null }) {
  if (matches === null) return null;
  return (
    <span
      className={`shrink-0 tabular-nums text-xs ${matches === 0 ? "text-muted" : ""}`}
      style={matches > 0 && color ? { color } : undefined}
      aria-label={`${matches} matching`}
    >
      {matches}
    </span>
  );
}

const lit = "bg-[color-mix(in_srgb,var(--accent)_16%,transparent)]";

export function FolderNode({ id, data }: NodeProps<FolderFlowNode>) {
  const actions = useMapActions();
  const { hovered, setHovered, clearHovered } = useHighlight();
  const listRef = useRef<HTMLUListElement>(null);
  const updateNodeInternals = useUpdateNodeInternals();
  const selectedPath = data.rows.find((row) => row.selected)?.path ?? null;
  const focusPath =
    hovered !== null && data.paths.includes(hovered) ? hovered : selectedPath;

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || !focusPath) return;
    const row = list.querySelector<HTMLElement>(`[data-path="${CSS.escape(focusPath)}"]`);
    if (!row) return;
    const top = row.offsetTop;
    const bottom = top + ROW_H;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
  }, [focusPath]);
  const collapsedLit =
    !data.open &&
    hovered !== null &&
    (hovered === data.path || data.paths.includes(hovered));
  const frame =
    data.selected || collapsedLit
      ? "shadow-[inset_0_0_0_1px_var(--accent)]"
      : "shadow-[inset_0_0_0_1px_var(--border)]";
  const dimmed = data.dimmed && !collapsedLit ? "opacity-30" : "";

  if (!data.open) {
    return (
      <div className={`relative h-full w-full bg-surface ${frame} ${dimmed}`}>
        <Handle type="target" position={Position.Left} id="in" className={handleClass} />
        <button
          type="button"
          className="flex h-full w-full items-start gap-1.5 px-2 py-1 text-left"
          aria-expanded={false}
          data-path={data.path}
          onMouseEnter={() => setHovered(data.path)}
          onMouseLeave={() => clearHovered(data.path)}
          onClick={(event) => {
            event.stopPropagation();
            actions.openNode(data.path);
          }}
        >
          {data.swatch ? (
            <span
              className="mt-1 size-2 shrink-0"
              style={{ backgroundColor: data.swatch }}
              aria-hidden
            />
          ) : null}
          <span className="min-w-0 flex-1 truncate font-mono text-xs">{data.label}</span>
          <MatchCount matches={data.matches} color={data.matchColor} />
        </button>
        <Handle type="source" position={Position.Right} id="out" className={handleClass} />
      </div>
    );
  }

  return (
    <div className={`flex h-full w-full flex-col bg-surface ${frame} ${dimmed}`}>
      <div className="relative shrink-0" style={{ height: HEADER_H }}>
        <button
          type="button"
          aria-expanded={true}
          data-path={data.path}
          className={`flex h-full w-full items-center gap-2 px-2 text-left text-xs ${
            hovered === data.path ? lit : ""
          }`}
          onMouseEnter={() => setHovered(data.path)}
          onMouseLeave={() => clearHovered(data.path)}
          onClick={(event) => {
            event.stopPropagation();
            actions.closeNode(data.path);
          }}
        >
          <span className="min-w-0 flex-1 truncate font-mono">{data.label}</span>
          <MatchCount matches={data.matches} color={data.matchColor} />
          <span className="shrink-0 tabular-nums text-muted">{data.fileCount}</span>
          <span className="shrink-0 tabular-nums text-incoming">in {data.fanIn}</span>
          <span className="shrink-0 tabular-nums text-outgoing">out {data.fanOut}</span>
        </button>
      </div>
      <ul
        ref={listRef}
        className="nowheel nopan relative min-h-0 overflow-y-auto overscroll-contain"
        style={{ height: Math.min(data.rows.length, ROW_LIMIT) * ROW_H }}
        onScroll={(event) => {
          const start = Math.floor(event.currentTarget.scrollTop / ROW_H);
          actions.setWindow(data.path, start);
          updateNodeInternals(id);
        }}
      >
        {data.rows.length > ROW_LIMIT ? (
          <>
            <Handle type="target" position={Position.Left} id="in:overflow" className={handleClass} />
            <Handle type="source" position={Position.Right} id="out:overflow" className={handleClass} />
          </>
        ) : null}
        {data.rows.map((row, index) => {
          const anchored = index >= data.windowStart && index < data.windowStart + ROW_LIMIT;
          const rowLit = hovered === row.path;
          return (
            <li key={row.path} data-path={row.path} className="relative" style={{ height: ROW_H }}>
              {anchored ? (
                <Handle
                  type="target"
                  position={Position.Left}
                  id={`in:${row.path}`}
                  className={handleClass}
                />
              ) : null}
              <button
                type="button"
                className={`flex h-full w-full items-center gap-1.5 px-2 text-left ${
                  row.selected || rowLit ? lit : ""
                } ${row.dimmed && !data.dimmed && !rowLit ? "opacity-30" : ""}`}
                aria-pressed={row.selected}
                onMouseEnter={() => setHovered(row.path)}
                onMouseLeave={() => clearHovered(row.path)}
                onClick={(event) => {
                  event.stopPropagation();
                  actions.selectFile(row.path);
                }}
              >
                <span className="size-2 shrink-0" style={{ backgroundColor: row.swatch }} aria-hidden />
                <span className="truncate font-mono text-xs">{row.label}</span>
              </button>
              {anchored ? (
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`out:${row.path}`}
                  className={handleClass}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
