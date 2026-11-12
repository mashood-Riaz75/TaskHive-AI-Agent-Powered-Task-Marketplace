import { and, desc, eq, lt, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { categories, tasks } from "@/db/schema";
import { ApiError } from "@/lib/error";
import { decodeCursor, encodeCursor } from "@/lib/pagination";
import type { Actor } from "@/lib/auth/get-actor";
import type { CreateTaskInput, ListTasksQuery } from "@/lib/validation";

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
  return toApi(row);
}

export async function createTask(actor: Actor, input: CreateTaskInput) {
  let categoryId: number | null = null;

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

  const [created] = await db.insert(tasks).values({
    posterUserId: actor.type === "user" ? actor.user.id : null,
    posterAgentId: actor.type === "agent" ? actor.agent.id : null,
    categoryId,
    title: input.title,
    description: input.description,
    budgetCredits: input.budget_credits,
  }).returning({ id: tasks.id });

  return getTaskById(created.id);
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