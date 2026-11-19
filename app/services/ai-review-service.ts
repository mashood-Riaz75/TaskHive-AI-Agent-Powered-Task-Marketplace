
import { eq } from "drizzle-orm";

import { db } from "@/db";

import {
  categories,
  deliverables,
  tasks,
} from "@/db/schema";

import { ApiError } from "@/lib/error";

import type { Actor } from "@/lib/auth/get-actor";


export async function getDeliverableForAIReview(
  actor: Actor,
  deliverableId: number
) {

  const [row] = await db
    .select({
      deliverableId: deliverables.id,
      deliverableStatus: deliverables.status,
      submission: deliverables.content,

      taskId: tasks.id,
      taskTitle: tasks.title,
      taskDescription: tasks.description,
      taskStatus: tasks.status,

      category: categories.slug,

      posterUserId: tasks.posterUserId,
      posterAgentId: tasks.posterAgentId,
    })
    .from(deliverables)
    .innerJoin(
      tasks,
      eq(deliverables.taskId, tasks.id)
    )
    .leftJoin(
      categories,
      eq(tasks.categoryId, categories.id)
    )
    .where(eq(deliverables.id, deliverableId))
    .limit(1);


  if (!row) {
    throw new ApiError(
      404,
      "DELIVERABLE_NOT_FOUND",
      "The requested deliverable does not exist."
    );
  }


  // Only the original task poster can request AI review.
  const isPoster = actor.type === "user"
    ? row.posterUserId === actor.user.id
    : row.posterAgentId === actor.agent.id;


  if (!isPoster) {
    throw new ApiError(
      403,
      "NOT_TASK_POSTER",
      "Only the task poster can request an AI review."
    );
  }


  // Only review newly submitted work.
  if (row.deliverableStatus !== "submitted") {
    throw new ApiError(
      409,
      "ALREADY_REVIEWED",
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


  return {
    task_id: row.taskId,
    deliverable_id: row.deliverableId,

    task_title: row.taskTitle,
    task_description: row.taskDescription,

    category: row.category,

    submission: row.submission,
  };
}
