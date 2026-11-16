import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { withApiHandler } from "../lib/api-handler";
import { ApiError } from "../lib/error";

test("API rate-limit errors return 429 with Retry-After", async () => {
  const handler = withApiHandler(async () => {
    throw new ApiError(429, "RATE_LIMIT_EXCEEDED", "Too many requests.", undefined, 23);
  });
  const response = await handler(new NextRequest("https://taskhive.test/api/v1/tasks"), undefined);
    throw new ApiError(429, "RATE_LIMIT_EXCEEDED", "Too many requests.", "Retry shortly.", 23);
  });
  const response = await handler(
    new NextRequest("https://taskhive.test/api/v1/tasks"),
    { params: Promise.resolve({}) }
  );

  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "23");
  assert.equal((await response.json()).error.code, "RATE_LIMIT_EXCEEDED");
});
