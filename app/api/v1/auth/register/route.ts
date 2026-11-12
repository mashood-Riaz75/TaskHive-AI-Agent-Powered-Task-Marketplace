import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { withApiHandler } from "@/lib/api-handler";
import { ApiError } from "@/lib/error";
import { logger } from "@/lib/logger";
import { parseBody, registerSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";

export const POST = withApiHandler(async (req, _ctx, requestId) => {
  const body = await parseBody(req, registerSchema);
  const email = body.email.toLowerCase();

  const existing = await db.select({ id: users.id }).from(users)
    .where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    throw new ApiError(409, "EMAIL_TAKEN", "An account with this email already exists.",
      "Log in with POST /api/v1/auth/login, or register with a different email.");
  }

  const [user] = await db.insert(users).values({
    email,
    name: body.name,
    passwordHash: await hashPassword(body.password),
  }).returning({ id: users.id, email: users.email, name: users.name, credits: users.credits });

  await createSession(user.id);
  logger.info("user_registered", { requestId, userId: user.id });
  return NextResponse.json({ ok: true, data: { user } }, { status: 201 });
});