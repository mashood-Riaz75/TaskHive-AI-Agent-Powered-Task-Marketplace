import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { agents, creditTransactions, deliverables, taskClaims, tasks, users } from "@/db/schema";
import { ApiError } from "@/lib/error";
import type { Actor } from "@/lib/auth/get-actor";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type PosterColumns = { posterUserId: number | null; posterAgentId: number | null };

function isPoster(actor: Actor, task: PosterColumns): boolean {
  return actor.type === "user"
    ? task.posterUserId === actor.user.id
    : task.posterAgentId === actor.agent.id;
}

// Lock the deliverable and its task, then check every rule in one place
async function loadForReview(tx: Tx, actor: Actor, deliverableId: number) {
  const [d] = await tx.select().from(deliverables)
    .where(eq(deliverables.id, deliverableId)).for("update");
  if (!d) {
    throw new ApiError(404, "DELIVERABLE_NOT_FOUND", `Deliverable ${deliverableId} does not exist.`,
      "List a task's deliverables with GET /api/v1/tasks/{taskId}/deliverables.");
  }
  const [task] = await tx.select().from(tasks).where(eq(tasks.id, d.taskId)).for("update");

  if (!isPoster(actor, task)) {
    throw new ApiError(403, "NOT_TASK_POSTER", "Only the poster of this task can review its deliverables.",
      "Use the account (or the agent API key) that created the task.");
  }
  if (d.status !== "submitted") {
    throw new ApiError(409, "ALREADY_REVIEWED", `Deliverable ${d.id} was already ${d.status}.`,
      "Each deliverable can be reviewed only once. List deliverables with GET /api/v1/tasks/" + task.id + "/deliverables.");
  }
  if (task.status !== "delivered") {
    throw new ApiError(409, "INVALID_TASK_STATE",
      `Task ${task.id} is '${task.status}', so its deliverable cannot be reviewed now.`,
      "Check the task with GET /api/v1/tasks/" + task.id);
  }
  return { d, task };
}

export async function acceptDeliverable(actor: Actor, deliverableId: number) {
  return db.transaction(async (tx) => {
    const { d, task } = await loadForReview(tx, actor, deliverableId);
    const now = new Date();

    const [agent] = await tx.select({ operatorId: agents.operatorId })
      .from(agents).where(eq(agents.id, d.agentId)).limit(1);

    await tx.update(deliverables).set({ status: "accepted", reviewedAt: now })
      .where(eq(deliverables.id, d.id));
    await tx.update(taskClaims).set({ status: "completed" })
      .where(eq(taskClaims.id, d.claimId));
    await tx.update(tasks).set({ status: "completed", updatedAt: now })
      .where(eq(tasks.id, task.id));

    // add credits atomically, so two accepts can never overwrite each other
    const [operator] = await tx.update(users)
      .set({ credits: sql`${users.credits} + ${task.budgetCredits}` })
      .where(eq(users.id, agent.operatorId))
      .returning({ credits: users.credits });

    await tx.insert(creditTransactions).values({
      userId: agent.operatorId,
      agentId: d.agentId,
      taskId: task.id,
      deliverableId: d.id,
      amount: task.budgetCredits,
      type: "task_reward",
      balanceAfter: operator.credits,
    });

    return {
      deliverable: { id: d.id, status: "accepted" },
      task: { id: task.id, status: "completed" },
      credits_awarded: {
        amount: task.budgetCredits,
        operator_user_id: agent.operatorId,
        agent_id: d.agentId,
        operator_balance: operator.credits,
      },
      note: "Credits are reputation points. Real payment happens outside TaskHive.",
    };
  });
}

export async function rejectDeliverable(actor: Actor, deliverableId: number, feedback: string) {
  return db.transaction(async (tx) => {
    const { d, task } = await loadForReview(tx, actor, deliverableId);
    const now = new Date();

    await tx.update(deliverables).set({ status: "rejected", feedback, reviewedAt: now })
      .where(eq(deliverables.id, d.id));
    await tx.update(tasks).set({ status: "claimed", updatedAt: now })
      .where(eq(tasks.id, task.id));

    return {
      deliverable: { id: d.id, status: "rejected", feedback },
      task: { id: task.id, status: "claimed" },
      next_step: "The agent can fix the work and deliver again with POST /api/v1/tasks/" + task.id + "/deliverables",
    };
  });
}

// The poster sees every delivery; an agent sees only its own
export async function listDeliverables(actor: Actor, taskId: number) {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) {
    throw new ApiError(404, "TASK_NOT_FOUND", `Task ${taskId} does not exist.`,
      "Browse tasks with GET /api/v1/tasks to find valid task ids.");
  }

  const rows = await db.select().from(deliverables)
    .where(eq(deliverables.taskId, taskId)).orderBy(desc(deliverables.id));

  const poster = isPoster(actor, task);
  const own = actor.type === "agent" ? rows.filter((r) => r.agentId === actor.agent.id) : [];

  if (!poster && own.length === 0) {
    throw new ApiError(403, "NOT_ALLOWED",
      "Only the task's poster or the agent that delivered work can see its deliverables.",
      "Use the poster's account, or the API key of the agent that delivered.");
  }

  return (poster ? rows : own).map((r) => ({
    id: r.id, task_id: r.taskId, agent_id: r.agentId, content: r.content,
    status: r.status, feedback: r.feedback,
    submitted_at: r.submittedAt, reviewed_at: r.reviewedAt,
  }));
}