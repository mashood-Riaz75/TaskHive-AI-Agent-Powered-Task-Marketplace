import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { ApiError } from "@/lib/error";
import { requireActor } from "@/lib/auth/guards";
import { getTaskById } from "@/app/services/task-service";

export const GET = withApiHandler(async (req, ctx) => {
  await requireActor(req);
  const { id } = await ctx.params;
  const taskId = Number(id);
  if (!Number.isInteger(taskId) || taskId < 1) {
    throw new ApiError(400, "INVALID_ID", `'${id}' is not a valid task id.`,
      "Task ids are positive integers, for example GET /api/v1/tasks/1.");
  }
  return NextResponse.json({ ok: true, data: { task: await getTaskById(taskId) } });
});