
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agents, categories, deliverables, tasks } from "@/db/schema";
import { ApiError } from "@/lib/error";
import type { Actor } from "@/lib/auth/get-actor";

async function loadReviewData(deliverableId: number) {
  const [row] = await db
    .select({
      deliverableId: deliverables.id,
      deliverableStatus: deliverables.status,
      aiReviewStatus: deliverables.aiReviewStatus,
      aiReview: deliverables.aiReview,
      submission: deliverables.content,

      taskId: tasks.id,
      taskTitle: tasks.title,
      taskDescription: tasks.description,
      taskStatus: tasks.status,

      category: categories.slug,

      posterUserId: tasks.posterUserId,
      posterAgentId: tasks.posterAgentId,
      agentName: agents.name,
    })
    .from(deliverables)
    .innerJoin(tasks, eq(deliverables.taskId, tasks.id))
    .innerJoin(agents, eq(deliverables.agentId, agents.id))
    .leftJoin(categories, eq(tasks.categoryId, categories.id))
    .where(eq(deliverables.id, deliverableId))
    .limit(1);

  if (!row) {
    throw new ApiError(
      404,
      "DELIVERABLE_NOT_FOUND",
      "The requested deliverable does not exist."
    );
  }

  return row;
}

function validateReviewState(row: Awaited<ReturnType<typeof loadReviewData>>) {
  if (row.deliverableStatus !== "submitted") {
    throw new ApiError(
      409,
      "DELIVERABLE_NOT_REVIEWABLE",
      "This deliverable is not waiting for review."
    );
  }

  if (row.taskStatus !== "delivered") {
    throw new ApiError(
      409,
      "INVALID_TASK_STATE",
      "The task is not currently waiting for review."
    );
  }
}

function buildReviewInput(
  row: Awaited<ReturnType<typeof loadReviewData>>
) {
  return {
    task_id: row.taskId,
    deliverable_id: row.deliverableId,
    task_title: row.taskTitle,
    task_description: row.taskDescription,
    category: row.category,
    submission: row.submission,
  };
}

// Public/manual review: only the original task poster can request this.
export async function getDeliverableForAIReview(
  actor: Actor,
  deliverableId: number
) {
  const row = await loadReviewData(deliverableId);

  const isPoster =
    actor.type === "user"
      ? row.posterUserId === actor.user.id
      : row.posterAgentId === actor.agent.id;

  if (!isPoster) {
    throw new ApiError(
      403,
      "NOT_TASK_POSTER",
      "Only the task poster can request an AI review."
    );
  }

  validateReviewState(row);

  return buildReviewInput(row);
}

// Internal worker: trusted server-side code only.
// Never expose this function through an unauthenticated public endpoint.
export async function getDeliverableForAutomaticAIReview(
  deliverableId: number
) {
  const row = await loadReviewData(deliverableId);

  validateReviewState(row);

  if (
    row.aiReviewStatus !== "processing" &&
    row.aiReviewStatus !== "queued"
  ) {
    throw new ApiError(
      409,
      "AI_REVIEW_NOT_QUEUED",
      "This deliverable does not have a pending AI review."
    );
  }

  return {
    ...buildReviewInput(row),
    agent_name: row.agentName,
  };
}
