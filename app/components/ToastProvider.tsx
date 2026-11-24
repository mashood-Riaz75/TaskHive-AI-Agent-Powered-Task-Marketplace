
"use client";

import { Suspense, useEffect } from "react";
import { usePathname } from "next/navigation";
import Pusher from "pusher-js";
import { Toaster, toast } from "sonner";
import { useMe } from "@/app/lib/use-me";
import { dispatchTaskStatusChange } from "@/app/lib/task-status-events";

type TaskPosterEvent = {
  task_id: number;
  task_title: string;
  agent_name: string;
};

type AIReviewEvent = {
  task_id: number;
  deliverable_id: number;
  task_title: string;
  agent_name: string;
  review: {
    overall_score: number;
    recommendation: "approve" | "request_changes" | "manual_review";
    summary: string;
  };
};

function isTaskPosterEvent(event: unknown): event is TaskPosterEvent {
  if (typeof event !== "object" || event === null) return false;

  const payload = event as Record<string, unknown>;

  return (
    typeof payload.task_id === "number" &&
    Number.isInteger(payload.task_id) &&
    payload.task_id > 0 &&
    typeof payload.task_title === "string" &&
    payload.task_title.length > 0 &&
    typeof payload.agent_name === "string" &&
    payload.agent_name.length > 0
  );
}

function isAIReviewEvent(event: unknown): event is AIReviewEvent {
  if (typeof event !== "object" || event === null) return false;

  const payload = event as Record<string, unknown>;

  if (
    typeof payload.task_id !== "number" ||
    typeof payload.deliverable_id !== "number" ||
    typeof payload.task_title !== "string" ||
    typeof payload.agent_name !== "string" ||
    typeof payload.review !== "object" ||
    payload.review === null
  ) {
    return false;
  }

  const review = payload.review as Record<string, unknown>;

  return (
    typeof review.overall_score === "number" &&
    review.overall_score >= 1 &&
    review.overall_score <= 5 &&
    typeof review.summary === "string" &&
    ["approve", "request_changes", "manual_review"].includes(
      review.recommendation as string
    )
  );
}

export default function ToastProvider({
  children,
}: {
  children: React.ReactNode;
}) {
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

      // Existing event: task claimed
      channel.bind("task.claimed", (event: unknown) => {
        if (!isTaskPosterEvent(event)) {
          console.error("realtime_event_invalid", {
            event: "task.claimed",
            payload: event,
          });
          return;
        }

        dispatchTaskStatusChange({
          taskId: event.task_id,
          status: "claimed",
        });

        toast.info(
          `${event.agent_name} claimed "${event.task_title}". Status changed to claimed.`
        );
      });

      // Existing event: task delivered
      channel.bind("task.delivered", (event: unknown) => {
        if (!isTaskPosterEvent(event)) {
          console.error("realtime_event_invalid", {
            event: "task.delivered",
            payload: event,
          });
          return;
        }

        dispatchTaskStatusChange({
          taskId: event.task_id,
          status: "delivered",
        });

        toast.success(
          `${event.agent_name} delivered work for "${event.task_title}". Status changed to delivered.`
        );
      });

      // New event: AI review completed
      channel.bind("task.ai_review_completed", (event: unknown) => {
        if (!isAIReviewEvent(event)) {
          console.error("realtime_event_invalid", {
            event: "task.ai_review_completed",
            payload: event,
          });
          return;
        }

        const { task_title, agent_name, review } = event;

        const description =
          `Score: ${review.overall_score}/5 · ` +
          review.summary;

        switch (review.recommendation) {
          case "approve":
            toast.success(
              `AI review completed for "${task_title}"`,
              {
                description: `${agent_name}'s submission received an approve recommendation. ${description}`,
                duration: 8000,
              }
            );
            break;

          case "request_changes":
            toast.warning(
              `AI recommends changes for "${task_title}"`,
              {
                description: `${agent_name}'s submission needs attention. ${description}`,
                duration: 8000,
              }
            );
            break;

          case "manual_review":
            toast.info(
              `Manual review recommended for "${task_title}"`,
              {
                description: `${agent_name}'s submission needs human evaluation. ${description}`,
                duration: 8000,
              }
            );
            break;
        }
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
        channel?.unbind("task.ai_review_completed");
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
