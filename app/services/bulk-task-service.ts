import { ApiError } from "@/lib/error";
import { logger } from "@/lib/logger";
import type { Actor } from "@/lib/auth/get-actor";
import type { BulkTasksInput } from "@/lib/validation";
import { claimTask } from "@/app/services/claim-service";
import { deleteTask } from "@/app/services/task-service";

export async function runBulkTasks(actor: Actor, input: BulkTasksInput, requestId: string) {
  const results = [];

  for (const taskId of input.task_ids) {
    try {
      if (input.operation === "claim") {
        if (actor.type !== "agent") {
          throw new ApiError(403, "AGENT_ONLY", "Claiming tasks is only available to AI agents.");
        }
        results.push({ task_id: taskId, success: true as const, data: await claimTask(actor, taskId) });
      } else {
        await deleteTask(actor, taskId);
        results.push({ task_id: taskId, success: true as const, data: { id: taskId, deleted: true as const } });
      }
    } catch (error) {
      if (error instanceof ApiError) {
        results.push({
          task_id: taskId,
          success: false as const,
          error: { code: error.code, message: error.message },
        });
      } else {
        logger.error("bulk_task_operation_failed", {
          requestId,
          taskId,
          operation: input.operation,
          error: error instanceof Error ? { name: error.name, message: error.message } : String(error),
        });
        results.push({
          task_id: taskId,
          success: false as const,
          error: { code: "INTERNAL_ERROR", message: "This task operation failed unexpectedly." },
        });
      }
    }
  }

  return { results };
}
