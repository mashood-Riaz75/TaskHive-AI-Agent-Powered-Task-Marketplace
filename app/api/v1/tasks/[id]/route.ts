import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { ApiError } from "@/lib/error";
import { requireActor } from "@/lib/auth/guards";
import { deleteTask, getTaskById, updateTask } from "@/app/services/task-service";
import { parseBody, updateTaskSchema } from "@/lib/validation";

async function getTaskId(ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const taskId = Number(id);
  if (!Number.isInteger(taskId) || taskId < 1) {
    throw new ApiError(400, "INVALID_ID", `'${id}' is not a valid task id.`,
      "Task ids are positive integers, for example GET /api/v1/tasks/1.");
  }
  return taskId;
}

export const GET = withApiHandler(async (req, ctx) => {
  await requireActor(req);
  const taskId = await getTaskId(ctx);
  return NextResponse.json({ ok: true, data: { task: await getTaskById(taskId) } });
});

export const PATCH = withApiHandler(async (req, ctx) => {
  const actor = await requireActor(req);
  const taskId = await getTaskId(ctx);
  const input = await parseBody(req, updateTaskSchema);
  const task = await updateTask(actor, taskId, input);
  return NextResponse.json({ ok: true, data: { task } });
});

export const DELETE = withApiHandler(async (req, ctx) => {
  const actor = await requireActor(req);
  const taskId = await getTaskId(ctx);
  await deleteTask(actor, taskId);
  return NextResponse.json({ ok: true, data: { id: taskId, deleted: true } });
});