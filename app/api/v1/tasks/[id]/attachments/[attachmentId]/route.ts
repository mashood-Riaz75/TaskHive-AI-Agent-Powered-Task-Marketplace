import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { ApiError } from "@/lib/error";
import { requireActor } from "@/lib/auth/guards";
import { getTaskAttachment } from "@/app/services/task-service";

export const GET = withApiHandler(async (req, ctx) => {
  await requireActor(req);
  const { id, attachmentId } = await ctx.params;
  const taskId = Number(id);
  const fileId = Number(attachmentId);
  if (!Number.isInteger(taskId) || taskId < 1 || !Number.isInteger(fileId) || fileId < 1) {
    throw new ApiError(400, "INVALID_ID", "Task and attachment ids must be positive integers.");
  }

  const attachment = await getTaskAttachment(taskId, fileId);
  const bytes = new Uint8Array(attachment.data.byteLength);
  bytes.set(attachment.data);
  const filename = encodeURIComponent(attachment.name).replace(/['()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": attachment.contentType,
      "Content-Disposition": `inline; filename*=UTF-8''${filename}`,
      "Content-Length": String(attachment.data.byteLength),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
