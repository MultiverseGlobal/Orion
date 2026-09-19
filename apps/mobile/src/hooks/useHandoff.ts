import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { router } from "expo-router";

// This client is strictly for Realtime Handoff Channels.
// Data access is still strictly routed through BrainGateway/dbService.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

// Only initialize if URL is provided to prevent crash on startup when env vars are missing
const realtimeClient = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export function useHandoffReceiver(userId: string | undefined) {
  const [activeSession, setActiveSession] = useState<{
    app: string;
    path: string;
    search: string;
    timestamp: string;
  } | null>(null);

  useEffect(() => {
    if (!userId || !realtimeClient) return;

    const channelName = `handoff-${userId}`;
    const channel = realtimeClient.channel(channelName);

    channel.on("broadcast", { event: "active_state" }, (payload) => {
      console.log("Handoff received:", payload);
      setActiveSession(payload.payload);
    });

    channel.subscribe();

    return () => {
      if (realtimeClient) realtimeClient.removeChannel(channel);
    };
  }, [userId]);

  return { activeSession };
}

export function useHandoffBroadcast(userId: string | undefined, currentPath: string, searchParams: string = "") {
  useEffect(() => {
    if (!userId || !realtimeClient) return;

    const channelName = `handoff-${userId}`;
    const channel = realtimeClient.channel(channelName);

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        channel.send({
          type: "broadcast",
          event: "active_state",
          payload: {
            app: "Orion",
            path: currentPath,
            search: searchParams,
            timestamp: new Date().toISOString(),
          },
        });
      }
    });

    return () => {
      if (realtimeClient) realtimeClient.removeChannel(channel);
    };
  }, [userId, currentPath, searchParams]);
}
