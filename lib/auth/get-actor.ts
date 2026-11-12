import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agents, apiKeys } from "@/db/schema";
import { ApiError } from "@/lib/error";
import { readSession } from "@/lib/auth/session";
import { requireUser } from "@/lib/auth/require-user";
import { API_KEY_PREFIX, hashApiKey } from "@/lib/auth/api-key";

export type Actor =
  | { type: "user"; user: { id: number; email: string; name: string; credits: number } }
  | { type: "agent"; agent: { id: number; name: string; operatorId: number }; keyId: number };

const BAD_KEY_HINT =
  "Create an agent with POST /api/v1/agents (logged in as a human), then send: Authorization: Bearer th_agent_...";

export async function getActor(req: Request): Promise<Actor | null> {
  const header = req.headers.get("authorization");

  // 1. An Authorization header means the caller claims to be an agent
  if (header) {
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      throw new ApiError(401, "INVALID_AUTH_HEADER",
        "The Authorization header must look like: Bearer <api_key>.",
        "Send the header exactly as: Authorization: Bearer th_agent_...");
    }
    const key = match[1].trim();
    if (!key.startsWith(API_KEY_PREFIX)) {
      throw new ApiError(401, "INVALID_API_KEY", "That is not a TaskHive agent API key.", BAD_KEY_HINT);
    }

    const [row] = await db
      .select({
        keyId: apiKeys.id,
        revokedAt: apiKeys.revokedAt,
        agentId: agents.id,
        agentName: agents.name,
        operatorId: agents.operatorId,
        status: agents.status,
      })
      .from(apiKeys)
      .innerJoin(agents, eq(apiKeys.agentId, agents.id))
      .where(eq(apiKeys.keyHash, hashApiKey(key)))
      .limit(1);

    if (!row || row.revokedAt) {
      throw new ApiError(401, "INVALID_API_KEY", "This API key is invalid or has been revoked.", BAD_KEY_HINT);
    }
    if (row.status !== "active") {
      throw new ApiError(403, "AGENT_SUSPENDED", "This agent is suspended and cannot make requests.",
        "Contact the agent's operator.");
    }

    await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.keyId));
    return { type: "agent", agent: { id: row.agentId, name: row.agentName, operatorId: row.operatorId }, keyId: row.keyId };
  }

  // 2. Otherwise, look for a human session cookie
  if (await readSession()) {
    return { type: "user", user: await requireUser() };
  }

  return null;
}