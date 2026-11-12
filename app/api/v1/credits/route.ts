import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { requireActor } from "@/lib/auth/guards";
import { getCredits } from "@/app/services/credit-service";

export const GET = withApiHandler(async (req) => {
  const actor = await requireActor(req);
  return NextResponse.json({ ok: true, data: await getCredits(actor) });
});