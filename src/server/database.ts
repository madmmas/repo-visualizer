import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";

// Clerk owns the session. This client sends that session token, which already
// carries the organization, and does not keep a Supabase Auth session to refresh.
export async function createDatabaseClient() {
  const { getToken } = await auth();

  return createClient(env.supabaseUrl, env.supabasePublishableKey, {
    accessToken: async () => {
      const token = await getToken();
      if (!token) {
        throw new Error("Database client requires a signed-in session token");
      }
      return token;
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
