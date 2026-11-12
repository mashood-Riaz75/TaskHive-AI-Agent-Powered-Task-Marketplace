import { NextResponse } from "next/server";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { agents, apiKeys } from "@/db/schema";
import { withApiHandler } from "@/lib/api-handler";
import { logger } from "@/lib/logger";
import { parseBody, createAgentSchema } from "@/lib/validation";
import { requireUser } from "@/lib/auth/require-user";
import { generateApiKey } from "@/lib/auth/api-key";

// Create an agent and return its API key (once)
export const POST = withApiHandler(async (req, _ctx, requestId) => {
  const user = await requireUser();
  const body = await parseBody(req, createAgentSchema);
  const { key, prefix, hash } = generateApiKey();

  // One transaction: either both rows are saved, or neither
  const agent = await db.transaction(async (tx) => {
    const [created] = await tx.insert(agents).values({
      operatorId: user.id,
      name: body.name,
      description: body.description ?? null,
    }).returning({
      id: agents.id, name: agents.name, description: agents.description,
      status: agents.status, createdAt: agents.createdAt,
    });
    await tx.insert(apiKeys).values({ agentId: created.id, keyPrefix: prefix, keyHash: hash });
    return created;
  });

  logger.info("agent_created", { requestId, userId: user.id, agentId: agent.id });

  return NextResponse.json({
    ok: true,
    data: {
      agent: { id: agent.id, name: agent.name, description: agent.description,
               status: agent.status, created_at: agent.createdAt },
      api_key: key,
      note: "Copy this API key now. It is shown only once and cannot be recovered.",
    },
  }, { status: 201 });
});

// List my agents (never returns full keys)
export const GET = withApiHandler(async () => {
  const user = await requireUser();

  const myAgents = await db.select().from(agents)
    .where(eq(agents.operatorId, user.id)).orderBy(desc(agents.id));

  const ids = myAgents.map((a) => a.id);
  const keys = ids.length
    ? await db.select({
        agentId: apiKeys.agentId, keyPrefix: apiKeys.keyPrefix,
        lastUsedAt: apiKeys.lastUsedAt, createdAt: apiKeys.createdAt,
      }).from(apiKeys)
        .where(and(inArray(apiKeys.agentId, ids), isNull(apiKeys.revokedAt)))
    : [];

  const data = myAgents.map((a) => ({
    id: a.id, name: a.name, description: a.description, status: a.status,
    created_at: a.createdAt,
    keys: keys.filter((k) => k.agentId === a.id).map((k) => ({
      prefix: k.keyPrefix, last_used_at: k.lastUsedAt, created_at: k.createdAt,
    })),
  }));

  return NextResponse.json({ ok: true, data: { agents: data } });
});