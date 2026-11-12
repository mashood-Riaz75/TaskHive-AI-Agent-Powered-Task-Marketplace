import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { logger } from "@/lib/logger";
import { ApiError } from "@/lib/error";

type Handler = (req: NextRequest, ctx: any, requestId: string) => Promise<NextResponse>;

export function withApiHandler(handler: Handler) {
  return async (req: NextRequest, ctx: any) => {
    const requestId = randomUUID();
    const start = Date.now();
    const base = { requestId, method: req.method, path: req.nextUrl.pathname };

    try {
      const res = await handler(req, ctx, requestId);
      res.headers.set("x-request-id", requestId);
      logger.info("request", { ...base, status: res.status, ms: Date.now() - start });
      return res;
    } catch (err) {
      // Expected errors (bad input, not allowed, conflict)
      if (err instanceof ApiError) {
        logger.warn("api_error", { ...base, status: err.status, code: err.code, ms: Date.now() - start });
        return NextResponse.json(
          { ok: false, error: { code: err.code, message: err.message, suggestion: err.suggestion, request_id: requestId } },
          { status: err.status, headers: { "x-request-id": requestId } }
        );
      }

      // Unexpected bugs: log everything, tell the client very little
      logger.error("unhandled_error", {
        ...base,
        ms: Date.now() - start,
        error: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : String(err),
      });
      return NextResponse.json(
        { ok: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong on our side.", suggestion: "Retry shortly. If it persists, report this request_id.", request_id: requestId } },
        { status: 500, headers: { "x-request-id": requestId } }
      );
    }
  };
}