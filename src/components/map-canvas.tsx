"use client";

import {
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useStore,
  type Edge as FlowEdge,
  type NodeTypes,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Edge, ParsedFile } from "@/parser/types";
import { foldFiles } from "@/map/fold";
import { buildScene, type SceneEdge, type SceneNode, type Selection } from "@/map/scene";
import { FolderNode, type FolderFlowNode } from "./folder-node";
import { MapActionsContext, type MapActions } from "./map-actions";
import "@xyflow/react/dist/style.css";

const nodeTypes: NodeTypes = { folder: FolderNode };

export function MapCanvas({
  files,
  edges,
  rootName,
  selected,
  onSelect,
  selectFileRef,
}: {
  files: readonly ParsedFile[];
  edges: readonly Edge[];
  rootName: string;
  selected: Selection | null;
  onSelect: (selection: Selection | null) => void;
  selectFileRef: React.RefObject<(path: string) => void>;
}) {
  return (
    <ReactFlowProvider>
      <MapView
        files={files}
        edges={edges}
        rootName={rootName}
        selected={selected}
        onSelect={onSelect}
        selectFileRef={selectFileRef}
      />
    </ReactFlowProvider>
  );
}

function MapView({
  files,
  edges,
  rootName,
  selected,
  onSelect,
  selectFileRef,
}: {
  files: readonly ParsedFile[];
  edges: readonly Edge[];
  rootName: string;
  selected: Selection | null;
  onSelect: (selection: Selection | null) => void;
  selectFileRef: React.RefObject<(path: string) => void>;
}) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [windows, setWindows] = useState<Readonly<Record<string, number>>>({});
  const [fit, setFit] = useState<{ path: string; token: number } | null>(null);
  const { getViewport, setViewport } = useReactFlow();
  const viewWidth = useStore((state) => state.width);
  const viewHeight = useStore((state) => state.height);
  const fitted = useRef(0);

  const scene = useMemo(
    () =>
      buildScene({
        files,
        edges,
        rootName,
        open: [...open].sort(),
        selected,
        windows,
      }),
    [files, edges, rootName, open, selected, windows],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      if (event.altKey || event.metaKey || event.ctrlKey) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return;
      }
      if (!selectionMoves(scene.nodes, selected)) return;
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const next = stepSelection(scene.nodes, selected, direction);
      if (next) onSelect(next);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scene.nodes, selected, onSelect]);

  // The bounds come from the scene after the folder opened. Zoom only ever drops.
  useEffect(() => {
    if (!fit || fitted.current === fit.token) return;
    if (viewWidth === 0 || viewHeight === 0) return;
    const node = scene.nodes.find((item) => item.id === fit.path);
    if (!node?.open) return;
    fitted.current = fit.token;
    const viewport = getViewport();
    const next = reveal(node, viewport, viewWidth, viewHeight);
    if (!next) return;
    void setViewport(next, { duration: 0 });
  }, [fit, scene, viewWidth, viewHeight, getViewport, setViewport]);

  const openNode = useCallback((path: string) => {
    setOpen((current) => {
      if (current.has(path)) return current;
      const next = new Set(current);
      next.add(path);
      return next;
    });
    setWindows((current) => {
      if (current[path] === undefined) return current;
      const next = { ...current };
      delete next[path];
      return next;
    });
    onSelect({ kind: "node", path });
    setFit((current) => ({ path, token: (current?.token ?? 0) + 1 }));
  }, [onSelect]);

  const closeNode = useCallback((path: string) => {
    setOpen((current) => {
      if (!current.has(path)) return current;
      const next = new Set(current);
      next.delete(path);
      return next;
    });
    setWindows((current) => {
      if (current[path] === undefined) return current;
      const next = { ...current };
      delete next[path];
      return next;
    });
    onSelect({ kind: "node", path });
  }, [onSelect]);

  const nodeOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of foldFiles(files, edges).nodes) {
      for (const file of node.files) map.set(file.path, node.path);
    }
    return map;
  }, [files, edges]);

  const selectFile = useCallback(
    (path: string) => {
      const node = nodeOf.get(path);
      if (node && !open.has(node)) {
        setOpen((current) => {
          if (current.has(node)) return current;
          const next = new Set(current);
          next.add(node);
          return next;
        });
        setFit((current) => ({ path: node, token: (current?.token ?? 0) + 1 }));
      }
      onSelect({ kind: "file", path });
    },
    [nodeOf, open, onSelect],
  );
  // The pane lives outside this view, so it calls the same handler through the ref.
  useEffect(() => {
    selectFileRef.current = selectFile;
  }, [selectFile, selectFileRef]);

  const setWindow = useCallback((path: string, start: number) => {
    setWindows((current) => {
      if (current[path] === start) return current;
      return { ...current, [path]: start };
    });
  }, []);

  const actions = useMemo<MapActions>(
    () => ({ openNode, closeNode, selectFile, setWindow }),
    [openNode, closeNode, selectFile, setWindow],
  );

  const flowNodes = useMemo<FolderFlowNode[]>(
    () => scene.nodes.map(toFlowNode),
    [scene],
  );
  const flowEdges = useMemo<FlowEdge[]>(() => scene.edges.map(toFlowEdge), [scene]);

  return (
    <MapActionsContext.Provider value={actions}>
      <div className="h-full w-full">
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.06, maxZoom: 1 }}
          minZoom={0.2}
          maxZoom={1.75}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag
          zoomOnScroll
          zoomOnPinch
          proOptions={{ hideAttribution: false }}
          deleteKeyCode={null}
          selectionKeyCode={null}
          multiSelectionKeyCode={null}
          onPaneClick={() => onSelect(null)}
        />
      </div>
    </MapActionsContext.Provider>
  );
}

function reveal(
  node: SceneNode,
  viewport: { x: number; y: number; zoom: number },
  viewWidth: number,
  viewHeight: number,
): { x: number; y: number; zoom: number } | null {
  const pad = 16;
  const availableWidth = viewWidth - pad * 2;
  const availableHeight = viewHeight - pad * 2;
  if (availableWidth <= 0 || availableHeight <= 0) return null;

  let zoom = viewport.zoom;
  if (node.width * zoom > availableWidth || node.height * zoom > availableHeight) {
    zoom = Math.min(zoom, availableWidth / node.width, availableHeight / node.height);
  }

  if (zoom !== viewport.zoom) {
    return {
      x: (viewWidth - node.width * zoom) / 2 - node.x * zoom,
      y: (viewHeight - node.height * zoom) / 2 - node.y * zoom,
      zoom,
    };
  }

  const left = node.x * zoom + viewport.x;
  const top = node.y * zoom + viewport.y;
  const right = left + node.width * zoom;
  const bottom = top + node.height * zoom;
  let x = viewport.x;
  let y = viewport.y;
  if (left < pad) x += pad - left;
  else if (right > viewWidth - pad) x -= right - (viewWidth - pad);
  if (top < pad) y += pad - top;
  else if (bottom > viewHeight - pad) y -= bottom - (viewHeight - pad);
  if (x === viewport.x && y === viewport.y) return null;
  return { x, y, zoom };
}

function toFlowNode(node: SceneNode): FolderFlowNode {
  return {
    id: node.id,
    type: "folder",
    position: { x: node.x, y: node.y },
    width: node.width,
    height: node.height,
    className: "nopan",
    zIndex: node.open || node.selected ? 2 : 0,
    style: { width: node.width, height: node.height, pointerEvents: "all" },
    draggable: false,
    selectable: false,
    connectable: false,
    data: {
      path: node.id,
      label: node.label,
      fileCount: node.fileCount,
      fanIn: node.fanIn,
      fanOut: node.fanOut,
      open: node.open,
      selected: node.selected,
      dimmed: node.dimmed,
      swatch: node.swatch,
      rows: node.rows,
      paths: node.paths,
      windowStart: node.windowStart,
    },
  };
}

function selectionMoves(nodes: readonly SceneNode[], selected: Selection | null): boolean {
  if (!selected) return false;
  if (selected.kind === "node") {
    return nodes.some((node) => node.id === selected.path && node.open && node.rows.length > 0);
  }
  return nodes.some((node) => node.open && node.rows.some((row) => row.path === selected.path));
}

function stepSelection(
  nodes: readonly SceneNode[],
  selected: Selection | null,
  direction: 1 | -1,
): Selection | null {
  if (!selected) return null;
  if (selected.kind === "node") {
    const node = nodes.find((item) => item.id === selected.path && item.open);
    if (!node || node.rows.length === 0) return null;
    const row = direction === 1 ? node.rows[0] : node.rows[node.rows.length - 1];
    return row ? { kind: "file", path: row.path } : null;
  }
  const node = nodes.find(
    (item) => item.open && item.rows.some((row) => row.path === selected.path),
  );
  if (!node) return null;
  const index = node.rows.findIndex((row) => row.path === selected.path);
  const row = node.rows[index + direction];
  return row ? { kind: "file", path: row.path } : null;
}

function toFlowEdge(edge: SceneEdge): FlowEdge {
  const stroke =
    edge.dimmed
      ? "var(--border)"
      : edge.tone === "incoming"
        ? "var(--incoming)"
        : edge.tone === "outgoing"
          ? "var(--outgoing)"
          : "var(--muted)";
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    type: "smoothstep",
    selectable: false,
    zIndex: 0,
    style: { stroke, opacity: edge.dimmed ? 0.35 : 1, strokeWidth: 1 },
    markerEnd: { type: MarkerType.ArrowClosed, color: stroke, width: 14, height: 14 },
  };
}
