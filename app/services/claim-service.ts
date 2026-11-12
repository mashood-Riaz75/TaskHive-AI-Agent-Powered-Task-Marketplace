import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { agents,deliverables, taskClaims, tasks } from "@/db/schema";
import { ApiError } from "@/lib/error";
import type { Actor } from "@/lib/auth/get-actor";

type AgentActor = Extract<Actor, { type: "agent" }>;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Lock the task row so two requests can't change it at the same time
async function lockTask(tx: Tx, taskId: number) {
  const [task] = await tx.select().from(tasks).where(eq(tasks.id, taskId)).for("update");
  if (!task) {
    throw new ApiError(404, "TASK_NOT_FOUND", `Task ${taskId} does not exist.`,
      "Browse tasks with GET /api/v1/tasks?status=open to find valid task ids.");
  }
  return task;
}

export async function claimTask(actor: AgentActor, taskId: number) {
  return db.transaction(async (tx) => {
    const task = await lockTask(tx, taskId);

    // Who is the human behind the poster?
    let posterOperatorId: number | null = task.posterUserId;
    if (task.posterAgentId) {
      const [posterAgent] = await tx.select({ operatorId: agents.operatorId })
        .from(agents).where(eq(agents.id, task.posterAgentId)).limit(1);
      posterOperatorId = posterAgent?.operatorId ?? null;
    }

    if (task.posterAgentId === actor.agent.id || posterOperatorId === actor.agent.operatorId) {
      throw new ApiError(403, "CANNOT_CLAIM_OWN_TASK",
        "An agent cannot claim a task posted by itself, by its own operator, or by another agent of the same operator.",
        "Claim a task posted by someone else: GET /api/v1/tasks?status=open");
    }
    if (task.status !== "open") {
      throw new ApiError(409, "TASK_NOT_OPEN",
        `Task ${taskId} cannot be claimed because its status is '${task.status}'.`,
        "Browse other tasks with GET /api/v1/tasks?status=open");
    }

    const [claim] = await tx.insert(taskClaims)
      .values({ taskId, agentId: actor.agent.id }).returning();
    await tx.update(tasks).set({ status: "claimed", updatedAt: new Date() })
      .where(eq(tasks.id, taskId));

    return {
      claim: { id: claim.id, task_id: taskId, agent_id: claim.agentId,
               status: claim.status, claimed_at: claim.claimedAt },
      task: { id: taskId, status: "claimed" },
      next_step: `Do the work, then submit it with POST /api/v1/tasks/${taskId}/deliverables`,
    };
  });
}

export async function deliverWork(actor: AgentActor, taskId: number, content: string) {
  return db.transaction(async (tx) => {
    const task = await lockTask(tx, taskId);

    const [claim] = await tx.select().from(taskClaims)
      .where(eq(taskClaims.taskId, taskId)).orderBy(desc(taskClaims.id)).limit(1);

    if (!claim) {
      throw new ApiError(409, "TASK_NOT_CLAIMED", `Task ${taskId} has not been claimed yet.`,
        `Claim it first with POST /api/v1/tasks/${taskId}/claims`);
    }
    if (claim.agentId !== actor.agent.id) {
      throw new ApiError(403, "NOT_CLAIM_HOLDER", `Task ${taskId} is claimed by a different agent.`,
        "Only the agent that claimed a task can deliver it. Browse tasks with GET /api/v1/tasks?status=open");
    }
    if (task.status === "delivered") {
      throw new ApiError(409, "ALREADY_DELIVERED",
        `Work for task ${taskId} was already delivered and is waiting for the poster's review.`,
        "Wait for the poster to accept or reject it. If it is rejected, the task returns to 'claimed' and you can deliver again.");
    }
    if (task.status === "completed") {
      throw new ApiError(409, "TASK_COMPLETED", `Task ${taskId} is already completed.`,
        "Browse other tasks with GET /api/v1/tasks?status=open");
    }
    if (task.status !== "claimed") {
      throw new ApiError(409, "INVALID_TASK_STATE",
        `Task ${taskId} cannot receive a delivery while its status is '${task.status}'.`,
        "Check the task with GET /api/v1/tasks/" + taskId);
    }

    const [d] = await tx.insert(deliverables)
      .values({ taskId, claimId: claim.id, agentId: actor.agent.id, content }).returning();
    await tx.update(tasks).set({ status: "delivered", updatedAt: new Date() })
      .where(eq(tasks.id, taskId));

    return {
      deliverable: { id: d.id, task_id: taskId, agent_id: d.agentId,
                     status: d.status, submitted_at: d.submittedAt },
      task: { id: taskId, status: "delivered" },
      next_step: "The poster will review your work. Credits are awarded when they accept it.",
    };
  });
}
   