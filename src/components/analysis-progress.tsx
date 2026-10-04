"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatBytes, formatCount, formatTaken, formatWhen } from "@/analysis/format";
import { stopAnalysis } from "@/server/analysis-actions";
import type { AnalysisProgress } from "@/server/analyses";
import { useStageFeed } from "./stage-feed";

export function AnalysisProgressView({ analysis }: { analysis: AnalysisProgress }) {
  const router = useRouter();
  const [stage, setStage] = useState(analysis.stage);
  const [message, setMessage] = useState(analysis.message);
  const [stale, setStale] = useState(analysis.stale);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const going = (analysis.state === "running" || analysis.state === "queued") && !stale;
  const watching = analysis.state === "running" || analysis.state === "queued" ? [analysis.id] : [];

  useStageFeed(
    watching,
    (_id, nextStage, nextMessage) => {
      setStage(nextStage);
      setMessage(nextMessage);
      setStale(false);
      router.refresh();
    },
    setFeedError,
  );

  return (
    <div className="px-3 py-3 text-xs">
      <p className="truncate font-mono">{analysis.repository}</p>
      <dl className="mt-2 grid grid-cols-[4.5rem_1fr] gap-x-2">
        <dt className="text-muted">Size</dt>
        <dd className="font-mono">{analysis.sizeBytes === null ? "not reported" : formatBytes(analysis.sizeBytes)}</dd>
        <dt className="text-muted">Files</dt>
        <dd className="font-mono">
          {analysis.filesFound !== null
            ? formatCount(analysis.filesFound)
            : analysis.repositoryFiles !== null
              ? formatCount(analysis.repositoryFiles)
              : "not reported"}
        </dd>
        {analysis.analysedAt ? (
          <>
            <dt className="text-muted">Analysed</dt>
            <dd>{formatWhen(analysis.analysedAt)}</dd>
          </>
        ) : null}
        {analysis.startedAt && analysis.analysedAt ? (
          <>
            <dt className="text-muted">Time</dt>
            <dd className="font-mono">{formatTaken(analysis.startedAt, analysis.analysedAt)}</dd>
          </>
        ) : null}
      </dl>
      <p className="mt-3 text-muted">Stage</p>
      <p className="font-mono">{stage ?? analysis.state}</p>
      {message ? <p className="mt-2 max-w-xl text-pretty">{message}</p> : null}
      {analysis.state === "failed" ? <p className="mt-2">failed</p> : null}
      {stale ? <p className="mt-2">This run is stale.</p> : null}
      {going ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setActionError(null);
            startTransition(async () => {
              const result = await stopAnalysis(analysis.id);
              if (result?.error) setActionError(result.error);
              else router.refresh();
            });
          }}
          className="mt-3 border border-border px-1.5 py-0.5 disabled:opacity-60"
        >
          {pending ? "Stopping" : "Stop"}
        </button>
      ) : null}
      {actionError ? (
        <p className="mt-2 text-pretty" role="alert">
          {actionError}
        </p>
      ) : null}
      {feedError ? (
        <p className="mt-2 text-pretty" role="alert">
          {feedError}
        </p>
      ) : null}
    </div>
  );
}
