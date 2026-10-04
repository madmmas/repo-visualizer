import { createDatabaseClient } from "@/server/database";

export type Analysis = {
  id: number;
  repository: string;
  state: string;
};

// The policy on analyses decides which organization's rows come back.
export async function listAnalyses(): Promise<
  { analyses: Analysis[] } | { error: string }
> {
  const db = await createDatabaseClient();
  const { data, error } = await db
    .from("analyses")
    .select("id, repository, state")
    .order("created_at", { ascending: false });

  if (error) {
    return { error: error.message };
  }

  return { analyses: data };
}
