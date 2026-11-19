
import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { taskClaims, tasks } from "@/db/schema";
import { withApiHandler } from "@/lib/api-handler";
import { requireAgent } from "@/lib/auth/guards";

export const GET = withApiHandler(async (req) => {
  const actor = await requireAgent(req);

  const claims = await db
    .select({
      claim_id: taskClaims.id,
      task_id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      budget_credits: tasks.budgetCredits,
      status: tasks.status,
    })
    .from(taskClaims)
    .innerJoin(tasks, eq(taskClaims.taskId, tasks.id))
    .where(eq(taskClaims.agentId, actor.agent.id))
    .orderBy(desc(taskClaims.id));

  return NextResponse.json({
    ok: true,
    data: {
      claims: claims.filter((claim) => claim.status === "claimed"),
    },
  });
});
