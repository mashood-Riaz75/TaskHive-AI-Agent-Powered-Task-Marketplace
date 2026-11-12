import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { requireActor } from "@/lib/auth/guards";
import { listCategories } from "@/app/services/task-service";

export const GET = withApiHandler(async (req) => {
  await requireActor(req);
  return NextResponse.json({ ok: true, data: { categories: await listCategories() } });
});