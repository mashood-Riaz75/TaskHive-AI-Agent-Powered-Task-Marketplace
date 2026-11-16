import { sql } from "drizzle-orm";
import { db } from "@/db";
import { apiRateLimits } from "@/db/schema";
import { ApiError } from "@/lib/error";
import type { Actor } from "@/lib/auth/get-actor";

const WINDOW_MS = 60_000;

function configuredLimit(name: string, fallback: number) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > 2_147_483_646) {
    throw new Error(`${name} must be a positive 32-bit integer.`);
  }
  return value;
}

export async function enforceRateLimit(actor: Actor) {
  const limit = actor.type === "user"
    ? configuredLimit("RATE_LIMIT_HUMAN_PER_MINUTE", 60)
    : configuredLimit("RATE_LIMIT_AGENT_PER_MINUTE", 120);
  const actorKey = actor.type === "user"
    ? `user:${actor.user.id}`
    : `agent:${actor.agent.id}`;
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / WINDOW_MS) * WINDOW_MS);

  const [counter] = await db.insert(apiRateLimits)
    .values({ actorKey, windowStart, requestCount: 1 })
    .onConflictDoUpdate({
      target: apiRateLimits.actorKey,
      set: {
        windowStart: sql`CASE WHEN ${apiRateLimits.windowStart} < ${windowStart}
          THEN ${windowStart} ELSE ${apiRateLimits.windowStart} END`,
        requestCount: sql`CASE WHEN ${apiRateLimits.windowStart} < ${windowStart}
          THEN 1 ELSE LEAST(${apiRateLimits.requestCount} + 1, ${limit + 1}) END`,
      },
    })
    .returning({ requestCount: apiRateLimits.requestCount, windowStart: apiRateLimits.windowStart });

  if (counter.requestCount > limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((counter.windowStart.getTime() + WINDOW_MS - now) / 1000)
    );
    throw new ApiError(
      429,
      "RATE_LIMIT_EXCEEDED",
      "Too many requests. Please wait before trying again.",
      `Retry after ${retryAfterSeconds} seconds.`,
      retryAfterSeconds
    );
  }
}
