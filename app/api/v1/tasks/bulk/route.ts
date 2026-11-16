import { NextResponse } from "next/server";
import { runBulkTasks } from "@/app/services/bulk-task-service";
import { ApiError } from "@/lib/error";
import { requireActor } from "@/lib/auth/guards";
import { withApiHandler } from "@/lib/api-handler";
import { logger } from "@/lib/logger";
import { bulkTasksSchema, parseBody } from "@/lib/validation";
import { withApiHandler } from "@/lib/api-handler";
import { logger } from "@/lib/logger";
import { requireActor } from "@/lib/auth/guards";
import { ApiError } from "@/lib/error";
import { bulkTasksSchema, parseBody } from "@/lib/validation";
import { runBulkTasks } from "@/app/services/bulk-task-service";

export const POST = withApiHandler(async (req, _ctx, requestId) => {
  const actor = await requireActor(req);
  const input = await parseBody(req, bulkTasksSchema);
  if (input.operation === "claim" && actor.type !== "agent") {
    throw new ApiError(403, "AGENT_ONLY", "Claiming tasks is only available to AI agents.",
      "Call this operation with Authorization: Bearer <agent api key>.");
  }

  const data = await runBulkTasks(actor, input, requestId);
  logger.info("bulk_tasks_processed", {
    requestId,
    operation: input.operation,
    actorType: actor.type,
    requested: input.task_ids.length,
    succeeded: data.results.filter((result) => result.success).length,
  });
  return NextResponse.json({ ok: true, data });
});
