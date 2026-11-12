import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { logger } from "@/lib/logger";
import { parseId } from "@/lib/params";
import { requireActor } from "@/lib/auth/guards";
import { acceptDeliverable } from "@/app/services/review-service";

export const POST = withApiHandler(async (req, ctx, requestId) => {
  const actor = await requireActor(req);
  const { id } = await ctx.params;
  const result = await acceptDeliverable(actor, parseId(id, "deliverable"));
  logger.info("deliverable_accepted", {
    requestId,
    deliverableId: result.deliverable.id,
    taskId: result.task.id,
    credits: result.credits_awarded.amount,
    operatorUserId: result.credits_awarded.operator_user_id,
  });
  return NextResponse.json({ ok: true, data: result });
});