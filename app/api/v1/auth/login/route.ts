import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { withApiHandler } from "@/lib/api-handler";
import { ApiError } from "@/lib/error";
import { logger } from "@/lib/logger";
import { parseBody, loginSchema } from "@/lib/validation";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";

export const POST = withApiHandler(async (req, _ctx, requestId) => {
  const body = await parseBody(req, loginSchema);
  const email = body.email.toLowerCase();

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const valid = user ? await verifyPassword(body.password, user.passwordHash) : false;

  if (!user || !valid) {
    logger.warn("login_failed", { requestId, email });
    throw new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.",
      "Check your credentials, or create an account with POST /api/v1/auth/register.");
  }

  await createSession(user.id);
  logger.info("login_success", { requestId, userId: user.id });
  return NextResponse.json({
    ok: true,
    data: { user: { id: user.id, email: user.email, name: user.name, credits: user.credits } },
  });
});