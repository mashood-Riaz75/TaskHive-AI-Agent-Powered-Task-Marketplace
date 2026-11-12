import { randomBytes, createHash } from "crypto";

const PREFIX = "th_agent_";

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateApiKey() {
  const key = PREFIX + randomBytes(24).toString("hex");
  return {
    key,                        // shown to the user once
    prefix: key.slice(0, 17),   // safe to store and display ("th_agent_" + 8 chars)
    hash: hashApiKey(key),      // the only thing we keep to verify later
  };
}

export const API_KEY_PREFIX = PREFIX;