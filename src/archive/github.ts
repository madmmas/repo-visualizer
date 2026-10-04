import { createWriteStream } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { once } from "node:events";
import { extractTarGz } from "./tar.ts";

// Public repositories only. No Authorization header is set, and nothing here
// reads or stores a token.

export const MAX_ARCHIVE_BYTES = 200 * 1024 * 1024;

export const TOO_BIG_MESSAGE = "This repository is over 200MB, so it will not be fetched.";

const headers = {
  accept: "application/vnd.github+json",
  "user-agent": "cartograph",
  "x-github-api-version": "2022-11-28",
};

export type PublicRepository = {
  owner: string;
  repo: string;
  url: string;
  sha: string;
};

export async function describePublicRepository(
  owner: string,
  repo: string,
  signal?: AbortSignal,
): Promise<PublicRepository> {
  const repository = await github(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    signal,
  );
  const defaultBranch = stringField(repository, "default_branch");
  const url = stringField(repository, "html_url");
  let commit: unknown;
  try {
    commit = await github(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(defaultBranch)}`,
      signal,
    );
  } catch (error) {
    if (error instanceof GitHubNotFound) {
      throw new Error("GitHub has no commit to fetch for that repository.");
    }
    throw error;
  }
  const sha = stringField(commit, "sha");
  if (!/^[0-9a-f]{40}$/.test(sha)) {
    throw new Error("GitHub did not return a commit for that repository.");
  }
  return { owner, repo, url, sha };
}

export type RepositoryPreview = {
  owner: string;
  repo: string;
  url: string;
  sizeBytes: number;
  sizeKnown: boolean;
  files: number;
  filesComplete: boolean;
  tooBig: boolean;
};

// Size and file count come from GitHub before any archive is downloaded.
// `size` on the repository is kilobytes. The same 200MB cap as the download
// applies here, so a repository that is already over that is not fetched.
export async function previewPublicRepository(owner: string, repo: string): Promise<RepositoryPreview> {
  const repository = await github(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
  );
  const url = stringField(repository, "html_url");
  const defaultBranch = stringField(repository, "default_branch");
  const sizeKilobytes = numberField(repository, "size");
  const sizeBytes = sizeKilobytes * 1024;
  let files = { count: 0, complete: true };
  try {
    const tree = await github(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`,
    );
    files = countFiles(tree);
  } catch (error) {
    if (!(error instanceof GitHubNotFound)) throw error;
  }
  return {
    owner,
    repo,
    url,
    sizeBytes,
    sizeKnown: sizeKilobytes > 0,
    files: files.count,
    filesComplete: files.complete,
    tooBig: sizeBytes > MAX_ARCHIVE_BYTES,
  };
}

// Returns the directory the archive was extracted into. The repository itself
// is still one folder inside that directory.
export async function downloadArchive(input: {
  owner: string;
  repo: string;
  sha: string;
  destination: string;
  signal?: AbortSignal;
}): Promise<string> {
  throwIfStopped(input.signal);
  const url = `https://codeload.github.com/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/tar.gz/${input.sha}`;
  const response = await fetch(url, {
    headers: { "user-agent": "cartograph", accept: "application/x-gzip" },
    redirect: "follow",
    signal: input.signal,
  });
  if (response.status === 404) {
    throw new Error("GitHub could not find an archive for that commit.");
  }
  if (!response.ok) {
    throw new Error(`GitHub refused the archive (${response.status}).`);
  }
  if (!response.body) throw new Error("GitHub returned an empty archive.");

  fs.mkdirSync(input.destination, { recursive: true });
  const archivePath = path.join(input.destination, "archive.tar.gz");
  await writeLimited(response.body, archivePath, input.signal);
  const extracted = path.join(input.destination, "tree");
  await extractTarGz(archivePath, extracted, input.signal);
  fs.rmSync(archivePath, { force: true });
  return extracted;
}

class GitHubNotFound extends Error {
  constructor() {
    super("GitHub could not find that repository.");
    this.name = "GitHubNotFound";
  }
}

async function github(url: string, signal?: AbortSignal): Promise<unknown> {
  throwIfStopped(signal);
  const response = await fetch(url, { headers, redirect: "follow", signal });
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = text;
    }
  }
  if (response.status === 404) throw new GitHubNotFound();
  if (!response.ok) {
    const message =
      isRecord(body) && typeof body.message === "string" ? body.message : response.statusText;
    throw new Error(`GitHub refused the request (${response.status}): ${message}`);
  }
  return body;
}

function numberField(value: unknown, key: string): number {
  if (!isRecord(value) || typeof value[key] !== "number" || !Number.isFinite(value[key]) || value[key] < 0) {
    throw new Error(`GitHub's response did not include ${key}.`);
  }
  return value[key];
}

function countFiles(value: unknown): { count: number; complete: boolean } {
  if (!isRecord(value) || !Array.isArray(value.tree)) {
    throw new Error("GitHub did not return a file list.");
  }
  let count = 0;
  for (const entry of value.tree) {
    if (isRecord(entry) && entry.type === "blob") count += 1;
  }
  return { count, complete: value.truncated !== true };
}

function stringField(value: unknown, key: string): string {
  if (!isRecord(value) || typeof value[key] !== "string" || value[key].length === 0) {
    throw new Error(`GitHub's response did not include ${key}.`);
  }
  return value[key];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function throwIfStopped(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error("Stopped.");
}

async function writeLimited(
  body: ReadableStream<Uint8Array>,
  filePath: string,
  signal?: AbortSignal,
): Promise<void> {
  throwIfStopped(signal);
  const reader = body.getReader();
  const file = createWriteStream(filePath);
  const onAbort = () => {
    void reader.cancel();
    file.destroy();
  };
  signal?.addEventListener("abort", onAbort, { once: true });
  let received = 0;
  try {
    for (;;) {
      throwIfStopped(signal);
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_ARCHIVE_BYTES) {
        throw new Error("The archive is over 200MB, so it was not fetched.");
      }
      if (!file.write(value)) await once(file, "drain");
    }
  } catch (error) {
    file.destroy();
    throw error;
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
  throwIfStopped(signal);
  await new Promise<void>((resolve, reject) => {
    file.end(() => resolve());
    file.on("error", reject);
  });
}
