"use client";

import { useSession } from "@clerk/nextjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef } from "react";
import { analysisChannel, stageMessage } from "@/analysis/channel";
import type { Database } from "@/types/database";

// The socket has to send the signed-in token. Clerk's session is what makes
// that token readable in the browser; a client without it would connect as no one.

function publicEnv(name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"): string {
  const value =
    name === "NEXT_PUBLIC_SUPABASE_URL"
      ? process.env.NEXT_PUBLIC_SUPABASE_URL
      : process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const trimmed = value?.trim();
  if (!trimmed) throw new Error(`Missing environment variable ${name}`);
  return trimmed;
}

export function useDatabase(): SupabaseClient<Database> {
  const { session } = useSession();
  return useMemo(
    () =>
      createClient<Database>(
        publicEnv("NEXT_PUBLIC_SUPABASE_URL"),
        publicEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
        {
          accessToken: async () => (await session?.getToken()) ?? null,
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        },
      ),
    [session],
  );
}

export function useStageFeed(
  ids: readonly number[],
  onStage: (id: number, stage: string, message: string) => void,
  onError: (message: string) => void,
): void {
  const db = useDatabase();
  const onStageRef = useRef(onStage);
  const onErrorRef = useRef(onError);
  const key = ids.join(",");

  useEffect(() => {
    onStageRef.current = onStage;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    if (!key) return;
    const watched = key.split(",").map((id) => Number(id));
    const channels = watched.map((id) => {
      const channel = db.channel(analysisChannel(id), { config: { private: true } });
      channel.on("broadcast", { event: "stage" }, (payload) => {
        const message = stageMessage(payload);
        if (!message) return;
        onStageRef.current(id, message.stage, message.message);
      });
      void channel.subscribe((status, error) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          onErrorRef.current(error?.message ?? "The progress channel did not connect.");
        }
      });
      return channel;
    });
    return () => {
      for (const channel of channels) void db.removeChannel(channel);
    };
  }, [db, key]);
}
