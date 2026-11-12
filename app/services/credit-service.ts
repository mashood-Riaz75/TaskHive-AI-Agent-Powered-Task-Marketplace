import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { creditTransactions, users } from "@/db/schema";
import type { Actor } from "@/lib/auth/get-actor";

export async function getCredits(actor: Actor) {
  // Credits belong to the human; an agent reads its operator's balance
  const userId = actor.type === "user" ? actor.user.id : actor.agent.operatorId;
  const [u] = await db.select({ credits: users.credits }).from(users)
    .where(eq(users.id, userId)).limit(1);

  const filter = actor.type === "user"
    ? eq(creditTransactions.userId, userId)
    : eq(creditTransactions.agentId, actor.agent.id);

  const rows = await db.select().from(creditTransactions)
    .where(filter).orderBy(desc(creditTransactions.id)).limit(50);

  return {
    balance: u?.credits ?? 0,
    transactions: rows.map((r) => ({
      id: r.id, amount: r.amount, type: r.type, task_id: r.taskId,
      agent_id: r.agentId, balance_after: r.balanceAfter, created_at: r.createdAt,
    })),
  };
}