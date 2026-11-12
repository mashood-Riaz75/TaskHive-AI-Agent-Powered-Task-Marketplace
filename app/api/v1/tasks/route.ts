import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { logger } from "@/lib/logger";
import { requireActor } from "@/lib/auth/guards";
import { createTaskSchema, listTasksQuerySchema, parseBody, parseQuery } from "@/lib/validation";
import { createTask, listTasks } from "@/app/services/task-service";

// Browse tasks (humans and agents)
export const GET = withApiHandler(async (req) => {
  const actor = await requireActor(req);
  const query = parseQuery(req, listTasksQuerySchema);
  const { tasks, meta } = await listTasks(query, actor);
  return NextResponse.json({ ok: true, data: { tasks }, meta });
});

// Post a task (humans and agents)
export const POST = withApiHandler(async (req, _ctx, requestId) => {
  const actor = await requireActor(req);
  const body = await parseBody(req, createTaskSchema);
  const task = await createTask(actor, body);
  logger.info("task_created", { requestId, taskId: task.id, posterType: actor.type });
  return NextResponse.json({ ok: true, data: { task } }, { status: 201 });
});