"use client";

import { Handle, Position, useUpdateNodeInternals, type Node, type NodeProps } from "@xyflow/react";
import { useLayoutEffect, useRef } from "react";
import { HEADER_H, ROW_H, ROW_LIMIT } from "@/map/metrics";
import type { SceneRow } from "@/map/scene";
import { useMapActions } from "./map-actions";

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
  rows: SceneRow[];
  windowStart: number;
};

export type FolderFlowNode = Node<FolderNodeData, "folder">;

const handleClass = "!size-px !min-h-0 !min-w-0 !border-0 !bg-transparent !opacity-0";

export function FolderNode({ id, data }: NodeProps<FolderFlowNode>) {
  const actions = useMapActions();
  const listRef = useRef<HTMLUListElement>(null);
  const updateNodeInternals = useUpdateNodeInternals();
  const selectedPath = data.rows.find((row) => row.selected)?.path ?? null;

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || !selectedPath) return;
    const row = list.querySelector<HTMLElement>(`[data-path="${CSS.escape(selectedPath)}"]`);
    if (!row) return;
    const top = row.offsetTop;
    const bottom = top + ROW_H;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
  }, [selectedPath]);
  const frame = data.selected
    ? "shadow-[inset_0_0_0_1px_var(--accent)]"
    : "shadow-[inset_0_0_0_1px_var(--border)]";
  const dimmed = data.dimmed ? "opacity-30" : "";

  if (!data.open) {
    return (
      <div className={`relative h-full w-full bg-surface ${frame} ${dimmed}`}>
        <Handle type="target" position={Position.Left} id="in" className={handleClass} />
        <button
          type="button"
          className="flex h-full w-full items-start gap-1.5 px-2 py-1 text-left"
          aria-expanded={false}
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
          <span className="font-mono text-xs">{data.label}</span>
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
          className="flex h-full w-full items-center gap-2 px-2 text-left text-xs"
          aria-expanded={true}
          onClick={(event) => {
            event.stopPropagation();
            actions.closeNode(data.path);
          }}
        >
          <span className="min-w-0 flex-1 truncate font-mono">{data.label}</span>
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
                  row.selected ? "bg-[color-mix(in_srgb,var(--accent)_16%,transparent)]" : ""
                } ${row.dimmed && !data.dimmed ? "opacity-30" : ""}`}
                aria-pressed={row.selected}
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
