"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatBytes, formatCount, formatTaken, formatWhen } from "@/analysis/format";
import { analysisPath } from "@/analysis/path";
import { deleteAnalysis, rerunAnalysis, stopAnalysis } from "@/server/analysis-actions";
import type { ListedAnalysis } from "@/server/analyses";
import { useStageFeed } from "./stage-feed";

export function AnalysisTable({ analyses }: { analyses: ListedAnalysis[] }) {
  const router = useRouter();
  const [live, setLive] = useState<Record<number, { stage: string; message: string }>>({});
  const [feedError, setFeedError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<{ id: number; action: "rerun" | "stop" | "delete" } | null>(null);
  const [pending, startTransition] = useTransition();
  const rows = analyses.map((row) => {
    const update = live[row.id];
    if (!update) return row;
    return { ...row, stage: update.stage, message: update.message, stale: false };
  });

  const watching = rows
    .filter((row) => row.state === "running" || row.state === "queued")
    .map((row) => row.id);
  useStageFeed(
    watching,
    (id, stage, message) => {
      setLive((current) => ({ ...current, [id]: { stage, message } }));
      router.refresh();
    },
    setFeedError,
  );

  if (rows.length === 0) {
    return <p className="mt-3 text-pretty text-xs">This team has not run an analysis.</p>;
  }

  return (
    <>
      {feedError ? (
        <p className="mt-2 text-pretty text-xs" role="alert">
          {feedError}
        </p>
      ) : null}
      {actionError ? (
        <p className="mt-2 text-pretty text-xs" role="alert">
          {actionError}
        </p>
      ) : null}
      <table className="mt-3 w-full text-left text-xs">
        <thead>
          <tr className="border-b border-border text-muted">
            <th className="py-1 font-normal" scope="col">
              Repository
            </th>
            <th className="w-36 py-1 font-normal" scope="col">
              Analysed
            </th>
            <th className="w-16 py-1 font-normal" scope="col">
              Time
            </th>
            <th className="w-20 py-1 font-normal" scope="col">
              Size
            </th>
            <th className="w-20 py-1 font-normal" scope="col">
              Files
            </th>
            <th className="w-24 py-1 font-normal" scope="col">
              State
            </th>
            <th className="w-24 py-1 font-normal" scope="col">
              Stage
            </th>
            <th className="w-36 py-1 font-normal" scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((analysis) => (
            <tr key={analysis.id} className="border-b border-border">
              <td className="max-w-0 py-1">
                <Link href={analysisPath(analysis.id, analysis.state)} className="block truncate font-mono">
                  {analysis.repository}
                </Link>
                {analysis.state === "failed" && analysis.failure ? (
                  <span className="block truncate text-muted">{analysis.failure}</span>
                ) : null}
              </td>
              <td className="py-1 text-muted">{analysis.analysedAt ? formatWhen(analysis.analysedAt) : ""}</td>
              <td className="py-1 font-mono">
                {analysis.startedAt && analysis.analysedAt ? formatTaken(analysis.startedAt, analysis.analysedAt) : ""}
              </td>
              <td className="py-1 font-mono">{analysis.sizeBytes === null ? "" : formatBytes(analysis.sizeBytes)}</td>
              <td
                className="py-1 font-mono"
                title={fileDetail(analysis)}
              >
                {fileTotal(analysis)}
              </td>
              <td className="py-1">{analysis.stale ? "stale" : analysis.state}</td>
              <td className="py-1 font-mono" title={analysis.message ?? undefined}>
                {analysis.stage ?? ""}
              </td>
              <td className="py-1">
                <div className="flex justify-end gap-1">
                  {stillRunning(analysis) ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        setActionError(null);
                        setBusy({ id: analysis.id, action: "stop" });
                        startTransition(async () => {
                          const result = await stopAnalysis(analysis.id);
                          if (result?.error) setActionError(result.error);
                          else router.refresh();
                          setBusy(null);
                        });
                      }}
                      className="border border-border px-1.5 py-0.5 disabled:opacity-60"
                    >
                      {pending && busy?.id === analysis.id && busy.action === "stop" ? "Stopping" : "Stop"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        setActionError(null);
                        setBusy({ id: analysis.id, action: "rerun" });
                        startTransition(async () => {
                          const result = await rerunAnalysis(analysis.id);
                          if (result?.error) {
                            setActionError(result.error);
                            setBusy(null);
                          }
                        });
                      }}
                      className="border border-border px-1.5 py-0.5 disabled:opacity-60"
                    >
                      {pending && busy?.id === analysis.id && busy.action === "rerun" ? "Starting" : "Rerun"}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (!window.confirm(`Delete ${analysis.repository}?`)) return;
                      setActionError(null);
                      setBusy({ id: analysis.id, action: "delete" });
                      startTransition(async () => {
                        const result = await deleteAnalysis(analysis.id);
                        if (result?.error) setActionError(result.error);
                        else router.refresh();
                        setBusy(null);
                      });
                    }}
                    className="border border-border px-1.5 py-0.5 disabled:opacity-60"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function stillRunning(analysis: ListedAnalysis): boolean {
  return (analysis.state === "running" || analysis.state === "queued") && !analysis.stale;
}

function fileTotal(analysis: ListedAnalysis): string {
  if (analysis.filesFound !== null) return formatCount(analysis.filesFound);
  if (analysis.repositoryFiles !== null) return formatCount(analysis.repositoryFiles);
  return "";
}

function fileDetail(analysis: ListedAnalysis): string | undefined {
  if (analysis.filesParsed === null || analysis.filesSkipped === null) return undefined;
  return `${formatCount(analysis.filesParsed)} parsed, ${formatCount(analysis.filesSkipped)} skipped`;
}
