import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { logger } from "@/lib/logger";
import { parseId } from "@/lib/params";
import { requireAgent } from "@/lib/auth/guards";
import { claimTask } from "@/app/services/claim-service";

export const POST = withApiHandler(async (req, ctx, requestId) => {
  const actor = await requireAgent(req);
  const { id } = await ctx.params;
  const taskId = parseId(id, "task");
  const result = await claimTask(actor, taskId);
  logger.info("task_claimed", { requestId, taskId, agentId: actor.agent.id });
  return NextResponse.json({ ok: true, data: result }, { status: 201 });
});