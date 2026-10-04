"use client";

import { useEffect, useMemo, useRef } from "react";
import { fileDetail, folderDetail, repoSummary } from "@/map/detail";
import type { Selection } from "@/map/scene";
import type { Edge, ParsedFile } from "@/parser/types";
import { useHighlight } from "./map-highlight";

export type DetailTab = "structure" | "explanation";

const lit = "bg-[color-mix(in_srgb,var(--accent)_16%,transparent)]";

export function DetailPane({
  name,
  framework,
  files,
  edges,
  imports,
  routes,
  selected,
  tab,
  onTab,
  onSelectFile,
}: {
  name: string;
  framework: string;
  files: readonly ParsedFile[];
  edges: readonly Edge[];
  imports: number;
  routes: number;
  selected: Selection | null;
  tab: DetailTab;
  onTab: (tab: DetailTab) => void;
  onSelectFile: (path: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const { hovered } = useHighlight();
  const summary = useMemo(
    () => repoSummary({ name, framework, files, imports, routes }),
    [name, framework, files, imports, routes],
  );
  const file = useMemo(
    () => (selected?.kind === "file" ? fileDetail(files, edges, selected.path) : null),
    [files, edges, selected],
  );
  const folder = useMemo(
    () => (selected?.kind === "node" ? folderDetail(files, edges, selected.path) : null),
    [files, edges, selected],
  );

  useEffect(() => {
    if (!hovered || !rootRef.current) return;
    const el = rootRef.current.querySelector<HTMLElement>(
      `[data-path="${CSS.escape(hovered)}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [hovered]);

  const subject = file ?? folder;
  if (!subject) {
    return (
      <div ref={rootRef} className="py-2 text-xs">
        <h2 className="px-2 font-mono">{summary.name}</h2>
        <dl className="mt-2">
          <Count term="Framework" value={summary.framework} />
          <Count term="Files" value={String(summary.files)} />
          <Count term="Imports" value={String(summary.imports)} />
          <Count term="Routes" value={String(summary.routes)} />
          <Count term="Unidentified" value={String(summary.unidentified)} />
        </dl>
        <PathSection
          title="Most imported"
          count={summary.leanedOn.length}
          onSelectFile={onSelectFile}
          rows={summary.leanedOn}
        />
        <PathSection
          title="Nothing imports"
          count={summary.unread.length}
          onSelectFile={onSelectFile}
          rows={summary.unread.map((path) => ({ path }))}
        />
      </div>
    );
  }

  const heading = subject.path === "." ? name : subject.path;

  return (
    <div ref={rootRef} className="flex min-h-full flex-col text-xs">
      <div className="sticky top-0 z-10 flex gap-3 border-b border-border bg-surface px-2" role="tablist">
        <TabButton id="structure" active={tab === "structure"} onTab={onTab}>
          Structure
        </TabButton>
        <TabButton id="explanation" active={tab === "explanation"} onTab={onTab}>
          Explanation
        </TabButton>
      </div>
      {tab === "explanation" ? (
        <div role="tabpanel" className="py-2">
          {file ? (
            <PathButton path={file.path} onSelectFile={onSelectFile} />
          ) : folder ? (
            <FolderHeading path={folder.path} label={heading} />
          ) : null}
          <p className="mt-2 px-2 text-pretty text-muted">No explanation yet.</p>
        </div>
      ) : file ? (
        <div role="tabpanel" className="py-2">
          <PathButton path={file.path} onSelectFile={onSelectFile} />
          <p className="mt-2 flex items-center gap-1.5 px-2">
            <span className="size-2 shrink-0" style={{ backgroundColor: file.kind.color }} aria-hidden />
            {file.kind.name}
          </p>
          <p className="px-2 tabular-nums text-muted">{file.lines} lines</p>
          <NeighbourList
            title="Depends on"
            tone="outgoing"
            paths={file.dependsOn}
            onSelectFile={onSelectFile}
          />
          <NeighbourList
            title="Depended on by"
            tone="incoming"
            paths={file.dependedOnBy}
            onSelectFile={onSelectFile}
          />
        </div>
      ) : folder ? (
        <div role="tabpanel" className="py-2">
          <FolderHeading path={folder.path} label={heading} />
          <FolderKinds folder={folder} />
        </div>
      ) : null}
    </div>
  );
}

function FolderHeading({ path, label }: { path: string; label: string }) {
  const { hovered, setHovered, clearHovered } = useHighlight();
  return (
    <p
      data-path={path}
      className={`break-all px-2 font-mono ${hovered === path ? lit : ""}`}
      onMouseEnter={() => setHovered(path)}
      onMouseLeave={() => clearHovered(path)}
    >
      {label}
    </p>
  );
}

function Count({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2 px-2 py-0.5">
      <dt className="text-muted">{term}</dt>
      <dd className="ml-auto min-w-0 break-all text-right font-mono">{value}</dd>
    </div>
  );
}

function TabButton({
  id,
  active,
  onTab,
  children,
}: {
  id: DetailTab;
  active: boolean;
  onTab: (tab: DetailTab) => void;
  children: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`border-b py-1.5 ${active ? "border-accent text-foreground" : "border-transparent text-muted"}`}
      onClick={() => onTab(id)}
    >
      {children}
    </button>
  );
}

function PathSection({
  title,
  count,
  rows,
  onSelectFile,
}: {
  title: string;
  count: number;
  rows: readonly { path: string; count?: number }[];
  onSelectFile: (path: string) => void;
}) {
  return (
    <section className="mt-3">
      <h3 className="flex items-baseline gap-2 px-2 text-muted">
        {title}
        <span className="ml-auto tabular-nums">{count}</span>
      </h3>
      <ul className="mt-1">
        {rows.map((row) => (
          <li key={row.path}>
            <PathButton path={row.path} count={row.count} onSelectFile={onSelectFile} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function NeighbourList({
  title,
  tone,
  paths,
  onSelectFile,
}: {
  title: string;
  tone: "incoming" | "outgoing";
  paths: readonly string[];
  onSelectFile: (path: string) => void;
}) {
  const toneClass = tone === "incoming" ? "text-incoming" : "text-outgoing";
  return (
    <section className="mt-3">
      <h3 className="flex items-baseline gap-2 px-2">
        {title}
        <span className={`ml-auto tabular-nums ${toneClass}`}>{paths.length}</span>
      </h3>
      <ul className="mt-1">
        {paths.map((path) => (
          <li key={path}>
            <PathButton path={path} onSelectFile={onSelectFile} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function PathButton({
  path,
  count,
  onSelectFile,
}: {
  path: string;
  count?: number;
  onSelectFile: (path: string) => void;
}) {
  const { hovered, setHovered, clearHovered } = useHighlight();
  return (
    <button
      type="button"
      data-path={path}
      className={`flex w-full items-baseline gap-2 px-2 py-0.5 text-left font-mono break-all ${
        hovered === path ? lit : ""
      }`}
      onMouseEnter={() => setHovered(path)}
      onMouseLeave={() => clearHovered(path)}
      onClick={() => onSelectFile(path)}
    >
      {count !== undefined ? (
        <span className="shrink-0 tabular-nums text-incoming">{count}</span>
      ) : null}
      <span className="min-w-0 break-all">{path}</span>
    </button>
  );
}

function FolderKinds({
  folder,
}: {
  folder: { fileCount: number; kinds: { id: string; name: string; count: number; color: string }[] };
}) {
  return (
    <>
      <p className="mt-2 px-2 tabular-nums text-muted">{folder.fileCount} files</p>
      <ul className="mt-1">
        {folder.kinds.map((kind) => (
          <li key={kind.id} className="flex items-center gap-2 px-2 py-0.5">
            <span className="size-2 shrink-0" style={{ backgroundColor: kind.color }} aria-hidden />
            <span className="min-w-0 truncate">{kind.name}</span>
            <span className="ml-auto pl-2 tabular-nums text-muted">{kind.count}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
