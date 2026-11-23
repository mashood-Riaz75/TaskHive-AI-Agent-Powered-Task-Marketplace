import Pusher from "pusher";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agents, tasks } from "@/db/schema";
import { logger } from "@/lib/logger";

function createPusherServer() {
  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER;

  if (!appId || !key || !secret || !cluster) {
    throw new Error("Pusher server environment variables are not configured.");
  }

  return new Pusher({ appId, key, secret, cluster, useTLS: true });
}

type TaskPosterEvent = "task.claimed" | "task.delivered";

async function notifyTaskPoster(taskId: number, agentName: string, event: TaskPosterEvent) {
  try {
    const [task] = await db.select({
      title: tasks.title,
      posterUserId: tasks.posterUserId,
      posterOperatorId: agents.operatorId,
    }).from(tasks)
      .leftJoin(agents, eq(tasks.posterAgentId, agents.id))
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (!task) {
      logger.warn("realtime_task_not_found", { taskId, event });
      return;
    }

    const posterUserId = task.posterUserId ?? task.posterOperatorId;
    if (!posterUserId) {
      logger.warn("realtime_poster_not_found", { taskId, event });
      return;
    }

    await createPusherServer().trigger(
      `private-user-${posterUserId}`,
      event,
      { task_id: taskId, task_title: task.title, agent_name: agentName }
    );
    logger.info("realtime_event_sent", { taskId, userId: posterUserId, event });
  } catch (error) {
    logger.warn("realtime_publish_failed", {
      taskId,
      event,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function notifyTaskClaimed(taskId: number, agentName: string) {
  await notifyTaskPoster(taskId, agentName, "task.claimed");
}

export async function notifyTaskDelivered(taskId: number, agentName: string) {
  await notifyTaskPoster(taskId, agentName, "task.delivered");
}

export function authorizeUserChannel(socketId: string, channelName: string) {
  try {
    return createPusherServer().authorizeChannel(socketId, channelName);
  } catch (error) {
    logger.warn("realtime_channel_authorization_failed", {
      channelName,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
