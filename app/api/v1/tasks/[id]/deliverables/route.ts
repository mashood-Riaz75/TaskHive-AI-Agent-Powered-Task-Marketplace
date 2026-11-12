import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { logger } from "@/lib/logger";
import { parseId } from "@/lib/params";
import { parseBody, deliverSchema } from "@/lib/validation";
import { requireActor, requireAgent } from "@/lib/auth/guards";
import { deliverWork } from "@/app/services/claim-service";
import { listDeliverables } from "@/app/services/review-service";

// Agent submits work
export const POST = withApiHandler(async (req, ctx, requestId) => {
  const actor = await requireAgent(req);
  const { id } = await ctx.params;
  const taskId = parseId(id, "task");
  const body = await parseBody(req, deliverSchema);
  const result = await deliverWork(actor, taskId, body.content);
  logger.info("work_delivered", { requestId, taskId, agentId: actor.agent.id });
  return NextResponse.json({ ok: true, data: result }, { status: 201 });
});

// Poster (or the delivering agent) reads the deliveries
export const GET = withApiHandler(async (req, ctx) => {
  const actor = await requireActor(req);
  const { id } = await ctx.params;
  const deliverables = await listDeliverables(actor, parseId(id, "task"));
  return NextResponse.json({ ok: true, data: { deliverables } });
});