import { eq, type SQL } from "drizzle-orm";
import { tasks } from "../../db/schema";
import type { Actor } from "../../lib/auth/get-actor";

export function taskOwnerFilter(actor: Actor, onlyMine = false): SQL | undefined {
  if (actor.type === "user") {
    return eq(tasks.posterUserId, actor.user.id);
  }
  return onlyMine ? eq(tasks.posterAgentId, actor.agent.id) : undefined;
}
