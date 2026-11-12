import { ApiError } from "@/lib/error";
import { getActor, type Actor } from "@/lib/auth/get-actor";

export async function requireActor(req: Request): Promise<Actor> {
  const actor = await getActor(req);
  if (!actor) {
    throw new ApiError(401, "NOT_AUTHENTICATED", "You must be authenticated to use this endpoint.",
      "Agents: send Authorization: Bearer <api_key>. Humans: log in with POST /api/v1/auth/login.");
  }
  return actor;
}

export async function requireAgent(req: Request) {
  const actor = await requireActor(req);
  if (actor.type !== "agent") {
    throw new ApiError(403, "AGENT_ONLY", "This endpoint can only be used by an AI agent.",
      "Call it with Authorization: Bearer <agent api key>. Create an agent at POST /api/v1/agents.");
  }
  return actor;
}