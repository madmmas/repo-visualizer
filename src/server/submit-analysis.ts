"use server";

import { auth } from "@clerk/nextjs/server";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { analysisPath } from "@/analysis/path";
import { previewPublicRepository, TOO_BIG_MESSAGE } from "@/archive/github";
import { parseRepositoryUrl } from "@/archive/url";
import { createDatabaseClientWithToken } from "@/server/database";
import { runAnalysis } from "@/server/run";

export type SubmitState = { error: string } | null;

export type LookupState =
  | { error: string }
  | {
      preview: {
        url: string;
        sizeBytes: number;
        sizeKnown: boolean;
        files: number;
        filesComplete: boolean;
        tooBig: boolean;
      };
    };

export async function lookupRepository(repository: string): Promise<LookupState> {
  const name = parseRepositoryUrl(repository);
  if (!name) {
    return {
      error: "Paste a public GitHub repository URL, like https://github.com/owner/repo.",
    };
  }
  try {
    const preview = await previewPublicRepository(name.owner, name.repo);
    return {
      preview: {
        url: preview.url,
        sizeBytes: preview.sizeBytes,
        sizeKnown: preview.sizeKnown,
        files: preview.files,
        filesComplete: preview.filesComplete,
        tooBig: preview.tooBig,
      },
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export async function submitRepository(
  _state: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const name = parseRepositoryUrl(String(formData.get("repository") ?? ""));
  if (!name) {
    return {
      error: "Paste a public GitHub repository URL, like https://github.com/owner/repo.",
    };
  }

  const { orgId, getToken } = await auth();
  if (!orgId) {
    return { error: "Sign in to an organization before analysing a repository." };
  }
  const token = await getToken();
  if (!token) {
    return { error: "Sign in again before analysing a repository." };
  }

  const db = createDatabaseClientWithToken(async () => token);
  const organization = await db
    .from("organizations")
    .upsert({ id: orgId }, { onConflict: "id", ignoreDuplicates: true });
  if (organization.error) return { error: organization.error.message };

  const existing = await db
    .from("analyses")
    .select("id, state, commit_sha, stage")
    .eq("repository_key", name.key)
    .maybeSingle();
  if (existing.error) return { error: existing.error.message };
  if (existing.data) {
    // Seeded rows are marked complete without a fetch. No commit and no stage
    // means this paste is the first run, still on the one row.
    if (existing.data.commit_sha === null && existing.data.stage === null) {
      const figures = await startFigures(name.owner, name.repo);
      if ("error" in figures) return figures;
      const id = existing.data.id;
      const started = await db
        .from("analyses")
        .update({
          repository: name.url,
          state: "running",
          stage: "fetch",
          stage_message: "Fetching the archive",
          failure: null,
          analysed_at: null,
          started_at: new Date().toISOString(),
          repository_bytes: figures.bytes,
          repository_files: figures.files,
        })
        .eq("id", id);
      if (started.error) return { error: started.error.message };
      after(() =>
        runAnalysis({
          id,
          owner: name.owner,
          repo: name.repo,
          organizationId: orgId,
          token,
          getToken,
        }),
      );
      redirect(analysisPath(id, "running"));
    }
    redirect(analysisPath(existing.data.id, existing.data.state));
  }

  const figures = await startFigures(name.owner, name.repo);
  if ("error" in figures) return figures;

  const inserted = await db
    .from("analyses")
    .insert({
      organization_id: orgId,
      repository: name.url,
      repository_key: name.key,
      state: "running",
      stage: "fetch",
      stage_message: "Fetching the archive",
      repository_bytes: figures.bytes,
      repository_files: figures.files,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (inserted.error) {
    if (inserted.error.code === "23505") {
      const again = await db
        .from("analyses")
        .select("id, state")
        .eq("repository_key", name.key)
        .maybeSingle();
      if (again.data) redirect(analysisPath(again.data.id, again.data.state));
    }
    return { error: inserted.error.message };
  }

  const id = inserted.data.id;
  after(() =>
    runAnalysis({
      id,
      owner: name.owner,
      repo: name.repo,
      organizationId: orgId,
      token,
      getToken,
    }),
  );
  redirect(analysisPath(id, "running"));
}

async function startFigures(
  owner: string,
  repo: string,
): Promise<{ error: string } | { bytes: number | null; files: number }> {
  try {
    const preview = await previewPublicRepository(owner, repo);
    if (preview.tooBig) return { error: TOO_BIG_MESSAGE };
    return { bytes: preview.sizeKnown ? preview.sizeBytes : null, files: preview.files };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
