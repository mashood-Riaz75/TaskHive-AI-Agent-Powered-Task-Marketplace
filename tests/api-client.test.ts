import assert from "node:assert/strict";
import test from "node:test";
import { api, ClientApiError, errorText } from "../app/lib/api-client";

test("rate-limit errors preserve and display the server Retry-After value", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({
      ok: false,
      error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many requests." },
    }),
    {
      status: 429,
      headers: { "content-type": "application/json", "retry-after": "19" },
    }
  );

  try {
    await assert.rejects(api("/tasks"), (error: unknown) => {
      assert.ok(error instanceof ClientApiError);
      assert.equal(error.retryAfterSeconds, 19);
      assert.equal(errorText(error), "Too many requests. Retry in 19 seconds.");
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
