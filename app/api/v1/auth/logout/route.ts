import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { destroySession } from "@/lib/auth/session";

export const POST = withApiHandler(async () => {
  await destroySession();
  return NextResponse.json({ ok: true, data: { loggedOut: true } });
});