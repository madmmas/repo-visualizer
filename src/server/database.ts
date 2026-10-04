import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import type { Database } from "@/types/database";

// Clerk owns the session. This client sends that session token, which already
// carries the organization, and does not keep a Supabase Auth session to refresh.
export async function createDatabaseClient() {
  const { getToken } = await auth();
  return createDatabaseClientWithToken(async () => {
    const token = await getToken();
    if (!token) {
      throw new Error("Database client requires a signed-in session token");
    }
    return token;
  });
}

// The pipeline keeps running after the response, so it supplies the token
// itself instead of reading the request again.
export function createDatabaseClientWithToken(getToken: () => Promise<string>) {
  return createClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
    accessToken: getToken,
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
