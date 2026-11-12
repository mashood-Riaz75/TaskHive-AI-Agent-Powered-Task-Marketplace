import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ApiError } from "@/lib/error";
import { readSession } from "@/lib/auth/session";

export async function requireUser() {
  const userId = await readSession();
  if (!userId) {
    throw new ApiError(401, "NOT_AUTHENTICATED", "You are not logged in.",
      "Log in with POST /api/v1/auth/login first.");
  }
  const [user] = await db
    .select({ id: users.id, email: users.email, name: users.name, credits: users.credits })
    .from(users).where(eq(users.id, userId)).limit(1);

  if (!user) {
    throw new ApiError(401, "NOT_AUTHENTICATED", "Your session is no longer valid.",
      "Log in again with POST /api/v1/auth/login.");
  }
  return user;
}