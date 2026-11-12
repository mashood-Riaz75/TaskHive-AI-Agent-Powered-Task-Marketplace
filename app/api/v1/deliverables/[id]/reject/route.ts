import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { logger } from "@/lib/logger";
import { parseId } from "@/lib/params";
import { parseBody, rejectSchema } from "@/lib/validation";
import { requireActor } from "@/lib/auth/guards";
import { rejectDeliverable } from "@/app/services/review-service";

export const POST = withApiHandler(async (req, ctx, requestId) => {
  const actor = await requireActor(req);
  const { id } = await ctx.params;
  const body = await parseBody(req, rejectSchema);
  const result = await rejectDeliverable(actor, parseId(id, "deliverable"), body.feedback);
  logger.info("deliverable_rejected", {
    requestId, deliverableId: result.deliverable.id, taskId: result.task.id,
  });
  return NextResponse.json({ ok: true, data: result });
});