import { and, desc, eq, lt, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { categories, creditTransactions, deliverables, taskAttachments, taskClaims, tasks } from "@/db/schema";
import { ApiError } from "@/lib/error";
import { decodeCursor, encodeCursor } from "@/lib/pagination";
import type { Actor } from "@/lib/auth/get-actor";
import type { CreateTaskInput, ListTasksQuery, UpdateTaskInput } from "@/lib/validation";
import {
  hasValidTaskAttachmentSignature,
  TASK_ATTACHMENT_CATEGORIES,
  taskAttachmentSelectionError,
} from "@/app/lib/task-attachments";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const taskSelect = {
  id: tasks.id,
  title: tasks.title,
  description: tasks.description,
  budgetCredits: tasks.budgetCredits,
  status: tasks.status,
  createdAt: tasks.createdAt,
  updatedAt: tasks.updatedAt,
  posterUserId: tasks.posterUserId,
  posterAgentId: tasks.posterAgentId,
  category: categories.slug,
};

type TaskRow = {
  id: number; title: string; description: string; budgetCredits: number; status: string;
  createdAt: Date; updatedAt: Date;
  posterUserId: number | null; posterAgentId: number | null; category: string | null;
};

function toApi(row: TaskRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    budget_credits: row.budgetCredits,
    status: row.status,
    category: row.category,
    poster: row.posterAgentId
      ? { type: "agent", id: row.posterAgentId }
      : { type: "user", id: row.posterUserId },
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export async function listCategories() {
  return db.select({ id: categories.id, name: categories.name, slug: categories.slug })
    .from(categories).orderBy(categories.name);
}

export async function getTaskById(id: number) {
  const [row] = await db.select(taskSelect).from(tasks)
    .leftJoin(categories, eq(tasks.categoryId, categories.id))
    .where(eq(tasks.id, id)).limit(1);

  if (!row) {
    throw new ApiError(404, "TASK_NOT_FOUND", `Task ${id} does not exist.`,
      "Browse tasks with GET /api/v1/tasks?status=open to find valid task ids.");
  }
  const attachments = await db.select({
    id: taskAttachments.id,
    name: taskAttachments.name,
    contentType: taskAttachments.contentType,
    size: taskAttachments.size,
  }).from(taskAttachments).where(eq(taskAttachments.taskId, id)).orderBy(taskAttachments.id);

  return {
    ...toApi(row),
    attachments: attachments.map((attachment) => ({
      id: attachment.id,
      name: attachment.name,
      content_type: attachment.contentType,
      size: attachment.size,
      url: `/api/v1/tasks/${id}/attachments/${attachment.id}`,
    })),
  };
}

export async function getTaskAttachment(taskId: number, attachmentId: number) {
  const [attachment] = await db.select({
    id: taskAttachments.id,
    name: taskAttachments.name,
    contentType: taskAttachments.contentType,
    data: taskAttachments.data,
  }).from(taskAttachments).where(and(
    eq(taskAttachments.taskId, taskId),
    eq(taskAttachments.id, attachmentId)
  )).limit(1);

  if (!attachment) {
    throw new ApiError(404, "ATTACHMENT_NOT_FOUND", "This task attachment does not exist.");
  }
  return attachment;
}

export async function createTask(actor: Actor, input: CreateTaskInput, files: File[] = []) {
  let categoryId: number | null = null;
  const fileError = taskAttachmentSelectionError(files, input.category?.toLowerCase());
  if (fileError) {
    throw new ApiError(400, "INVALID_ATTACHMENTS", fileError);
  }

  if (input.category) {
    const slug = input.category.toLowerCase();
    const [cat] = await db.select({ id: categories.id }).from(categories)
      .where(eq(categories.slug, slug)).limit(1);
    if (!cat) {
      const all = await listCategories();
      throw new ApiError(400, "UNKNOWN_CATEGORY", `Category '${input.category}' does not exist.`,
        `Use one of: ${all.map((c) => c.slug).join(", ")}. List them with GET /api/v1/categories.`);
    }
    categoryId = cat.id;
  }

  const attachmentRows = await Promise.all(files.map(async (file) => {
    const data = Buffer.from(await file.arrayBuffer());
    if (data.length !== file.size || !hasValidTaskAttachmentSignature(file.type, data)) {
      throw new ApiError(400, "INVALID_FILE_CONTENT", `The file '${file.name}' does not match its declared media type.`);
    }
    return {
      name: file.name.replace(/[\\/\u0000-\u001f\u007f]/g, "_").slice(0, 255) || "attachment",
      contentType: file.type,
      size: data.length,
      data,
    };
  }));

  const taskValues = {
    posterUserId: actor.type === "user" ? actor.user.id : null,
    posterAgentId: actor.type === "agent" ? actor.agent.id : null,
    categoryId,
    title: input.title,
    description: input.description,
    budgetCredits: input.budget_credits,
  };
  let taskId: number;
  if (attachmentRows.length === 0) {
    const [created] = await db.insert(tasks).values(taskValues).returning({ id: tasks.id });
    taskId = created.id;
  } else {
    taskId = await db.transaction(async (tx) => {
      const [created] = await tx.insert(tasks).values(taskValues).returning({ id: tasks.id });
      await tx.insert(taskAttachments).values(
        attachmentRows.map((attachment) => ({ ...attachment, taskId: created.id }))
      );
      return created.id;
    });
  }

  return getTaskById(taskId);
}

async function lockEditableTask(tx: Tx, actor: Actor, taskId: number) {
  const [task] = await tx.select().from(tasks).where(eq(tasks.id, taskId)).for("update");
  if (!task) {
    throw new ApiError(404, "TASK_NOT_FOUND", `Task ${taskId} does not exist.`);
  }

  const isPoster = actor.type === "user"
    ? task.posterUserId === actor.user.id
    : task.posterAgentId === actor.agent.id;
  if (!isPoster) {
    throw new ApiError(403, "NOT_TASK_POSTER", "Only the task poster can edit or delete this task.");
  }
  if (task.status !== "open") {
    throw new ApiError(409, "TASK_NOT_EDITABLE", "Only open tasks can be edited or deleted.");
  }
  return task;
}

export async function updateTask(actor: Actor, taskId: number, input: UpdateTaskInput) {
  await db.transaction(async (tx) => {
    const task = await lockEditableTask(tx, actor, taskId);
    let categoryId: number | null = null;

    if (input.category) {
      const [category] = await tx.select({ id: categories.id }).from(categories)
        .where(eq(categories.slug, input.category.toLowerCase())).limit(1);
      if (!category) {
        const all = await listCategories();
        throw new ApiError(400, "UNKNOWN_CATEGORY", `Category '${input.category}' does not exist.`,
          `Use one of: ${all.map((item) => item.slug).join(", ")}. List them with GET /api/v1/categories.`);
      }
      categoryId = category.id;
    }

    const [attachment] = await tx.select({ id: taskAttachments.id }).from(taskAttachments)
      .where(eq(taskAttachments.taskId, taskId)).limit(1);
    if (attachment && !TASK_ATTACHMENT_CATEGORIES.some((slug) => slug === input.category?.toLowerCase())) {
      throw new ApiError(400, "ATTACHMENT_CATEGORY_REQUIRED",
        "Tasks with attachments must remain in the code review or data extraction category.");
    }

    await tx.update(tasks).set({
      title: input.title,
      description: input.description,
      budgetCredits: input.budget_credits,
      categoryId,
      updatedAt: new Date(),
    }).where(eq(tasks.id, task.id));
  });

  return getTaskById(taskId);
}

export async function deleteTask(actor: Actor, taskId: number) {
  await db.transaction(async (tx) => {
    await lockEditableTask(tx, actor, taskId);
    const [claim] = await tx.select({ id: taskClaims.id }).from(taskClaims)
      .where(eq(taskClaims.taskId, taskId)).limit(1);
    const [deliverable] = await tx.select({ id: deliverables.id }).from(deliverables)
      .where(eq(deliverables.taskId, taskId)).limit(1);
    const [creditTransaction] = await tx.select({ id: creditTransactions.id }).from(creditTransactions)
      .where(eq(creditTransactions.taskId, taskId)).limit(1);
    if (claim || deliverable || creditTransaction) {
      throw new ApiError(409, "TASK_HAS_HISTORY", "Tasks with claim, delivery, or credit history cannot be deleted.");
    }
    await tx.delete(tasks).where(eq(tasks.id, taskId));
  });
}

export async function listTasks(q: ListTasksQuery, actor: Actor) {
  const conditions: SQL[] = [];
  if (q.status) conditions.push(eq(tasks.status, q.status));
  if (q.category) conditions.push(eq(categories.slug, q.category.toLowerCase()));
  if (q.poster === "me") {
    conditions.push(
      actor.type === "user"
        ? eq(tasks.posterUserId, actor.user.id)
        : eq(tasks.posterAgentId, actor.agent.id)
    );
  }
  if (q.cursor) conditions.push(lt(tasks.id, decodeCursor(q.cursor)));

  const rows = await db.select(taskSelect).from(tasks)
    .leftJoin(categories, eq(tasks.categoryId, categories.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(tasks.id))
    .limit(q.limit + 1);

  const hasMore = rows.length > q.limit;
  const page = hasMore ? rows.slice(0, q.limit) : rows;

  return {
    tasks: page.map(toApi),
    meta: {
      has_more: hasMore,
      next_cursor: hasMore ? encodeCursor(page[page.length - 1].id) : null,
      limit: q.limit,
    },
  };
}