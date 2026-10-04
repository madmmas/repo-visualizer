"use client";

import { useState, useTransition } from "react";
import { formatBytes, formatCount } from "@/analysis/format";
import { lookupRepository, submitRepository, type LookupState } from "@/server/submit-analysis";

export function AnalyseForm() {
  const [repository, setRepository] = useState("");
  const [lookup, setLookup] = useState<LookupState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const preview = lookup && "preview" in lookup ? lookup.preview : null;

  return (
    <form
      className="mt-3 max-w-xl"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        if (preview && !preview.tooBig) {
          const data = new FormData();
          data.set("repository", repository);
          startTransition(async () => {
            const result = await submitRepository(null, data);
            if (result?.error) setError(result.error);
          });
          return;
        }
        startTransition(async () => {
          const result = await lookupRepository(repository);
          setLookup(result);
          if ("error" in result) setError(result.error);
        });
      }}
    >
      <label className="block text-xs text-muted" htmlFor="repository">
        Repository URL
      </label>
      <div className="mt-1 flex gap-2">
        <input
          id="repository"
          name="repository"
          type="url"
          required
          spellCheck={false}
          autoComplete="off"
          placeholder="https://github.com/owner/repo"
          value={repository}
          onChange={(event) => {
            setRepository(event.target.value);
            setLookup(null);
            setError(null);
          }}
          className="min-w-0 flex-1 border border-border bg-background px-2 py-1 font-mono text-xs"
        />
        <button
          type="submit"
          disabled={pending || preview?.tooBig === true}
          className="shrink-0 border border-border bg-accent px-2 py-1 text-xs text-white disabled:opacity-60"
        >
          {pending ? "Working" : preview && !preview.tooBig ? "Start" : "Analyse"}
        </button>
      </div>
      {preview ? (
        <dl className="mt-2 grid grid-cols-[4.5rem_1fr] gap-x-2 text-xs">
          <dt className="text-muted">Size</dt>
          <dd className="font-mono">{preview.sizeKnown ? formatBytes(preview.sizeBytes) : "not reported"}</dd>
          <dt className="text-muted">Files</dt>
          <dd className="font-mono">
            {preview.filesComplete ? formatCount(preview.files) : `${formatCount(preview.files)}+`}
          </dd>
        </dl>
      ) : null}
      {preview && !preview.filesComplete ? (
        <p className="mt-1 text-pretty text-xs">GitHub stopped the file list early. The total is higher.</p>
      ) : null}
      {preview?.tooBig ? (
        <p className="mt-1 text-pretty text-xs" role="alert">
          This repository is over 200MB, so it will not be fetched.
        </p>
      ) : null}
      {error ? (
        <p className="mt-1 text-pretty text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
