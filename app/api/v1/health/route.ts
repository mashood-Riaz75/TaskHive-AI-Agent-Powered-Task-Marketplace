import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { withApiHandler } from "@/lib/api-handler";

export const GET = withApiHandler(async () => {
  await db.execute(sql`select 1`);
  return NextResponse.json({ ok: true, data: { status: "healthy" } });
});