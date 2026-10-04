import { rm } from "node:fs/promises";

// One process runs the pipeline. Stop and delete share this map so they can
// abort that process and wait until it has released the archive on disk.
// The map lives on globalThis so a refresh of this module does not lose the run.

type ActiveRun = {
  controller: AbortController;
  directory?: string;
  done: Promise<void>;
  finish: () => void;
  intent: "stop" | "delete" | null;
};

const runs = new Map<number, ActiveRun>();

function registry(): Map<number, ActiveRun> {
  const host = globalThis as typeof globalThis & { __cartographRuns?: Map<number, ActiveRun> };
  host.__cartographRuns ??= runs;
  return host.__cartographRuns;
}

export function beginRun(id: number): AbortController {
  const current = registry().get(id);
  current?.controller.abort();
  let finish = () => {};
  const done = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const controller = new AbortController();
  registry().set(id, { controller, done, finish, intent: null });
  return controller;
}

export function noteRunDirectory(id: number, controller: AbortController, directory: string): void {
  const run = registry().get(id);
  if (run?.controller === controller) run.directory = directory;
}

export function finishRun(id: number, controller: AbortController): void {
  const run = registry().get(id);
  if (!run || run.controller !== controller) return;
  run.finish();
  registry().delete(id);
}

// Resolves when the live run has finished, or immediately when there is none.
// True means a process was actually aborted.
export async function cancelRun(id: number, intent: "stop" | "delete"): Promise<boolean> {
  const run = registry().get(id);
  if (!run) return false;
  run.intent = intent;
  const directory = run.directory;
  run.controller.abort();
  await run.done;
  if (directory) await rm(directory, { recursive: true, force: true });
  return true;
}

export function runIntent(id: number): "stop" | "delete" | null {
  return registry().get(id)?.intent ?? null;
}
