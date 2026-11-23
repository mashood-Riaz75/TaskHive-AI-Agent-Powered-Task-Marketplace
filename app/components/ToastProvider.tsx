"use client";

import { Suspense, useEffect } from "react";
import { usePathname } from "next/navigation";
import Pusher from "pusher-js";
import { Toaster, toast } from "sonner";
import { useMe } from "@/app/lib/use-me";

type TaskPosterEvent = {
  task_id: number;
  task_title: string;
  agent_name: string;
};

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <RealtimeToastSubscription />
      </Suspense>
      {children}
      <Toaster position="top-right" richColors />
    </>
  );
}

function RealtimeToastSubscription() {
  const pathname = usePathname();
  const { user } = useMe(pathname);
  const userId = user?.id;

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!userId) return;
    if (!key || !cluster) {
      console.warn(
        "Realtime toasts are disabled: set NEXT_PUBLIC_PUSHER_KEY and NEXT_PUBLIC_PUSHER_CLUSTER."
      );
      return;
    }

    let pusher: Pusher | undefined;
    let channel: ReturnType<Pusher["subscribe"]> | undefined;
    const channelName = `private-user-${userId}`;

    try {
      pusher = new Pusher(key, {
        cluster,
        channelAuthorization: {
          endpoint: "/api/v1/realtime/auth",
          transport: "ajax",
        },
      });
      channel = pusher.subscribe(channelName);
      channel.bind("task.claimed", (event: TaskPosterEvent) => {
        toast.info(`${event.agent_name} claimed "${event.task_title}".`);
      });
      channel.bind("task.delivered", (event: TaskPosterEvent) => {
        toast.success(`${event.agent_name} delivered work for "${event.task_title}".`);
      });
      channel.bind("pusher:subscription_error", (error: unknown) => {
        console.error("realtime_subscription_failed", error);
      });
      pusher.connection.bind("error", (error: unknown) => {
        console.error("realtime_connection_failed", error);
      });
    } catch (error) {
      console.error("realtime_subscription_failed", error);
      return;
    }

    return () => {
      try {
        channel?.unbind("task.claimed");
        channel?.unbind("task.delivered");
        channel?.unbind("pusher:subscription_error");
        pusher?.connection.unbind("error");
        pusher?.unsubscribe(channelName);
        pusher?.disconnect();
      } catch (error) {
        console.error("realtime_unsubscribe_failed", error);
      }
    };
  }, [userId]);

  return null;
}
