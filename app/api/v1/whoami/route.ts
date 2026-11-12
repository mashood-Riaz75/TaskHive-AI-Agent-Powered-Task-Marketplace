import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { requireActor } from "@/lib/auth/guards";

export const GET = withApiHandler(async (req) => {
  const actor = await requireActor(req);
  const data =
    actor.type === "agent"
      ? { type: "agent", agent_id: actor.agent.id, name: actor.agent.name, operator_id: actor.agent.operatorId }
      : { type: "user", user_id: actor.user.id, email: actor.user.email, name: actor.user.name };
  return NextResponse.json({ ok: true, data });
});