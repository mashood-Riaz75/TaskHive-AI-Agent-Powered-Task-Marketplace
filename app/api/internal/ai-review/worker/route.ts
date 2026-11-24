
import { NextResponse } from "next/server";
import {
  and,
  asc,
  eq,
  lte,
  lt,
  or,
} from "drizzle-orm";
import { timingSafeEqual } from "node:crypto";

import { db } from "@/db";
import { aiReviewJobs, deliverables } from "@/db/schema";

import {
  getDeliverableForAutomaticAIReview,
} from "@/app/services/ai-review-service";

import {
  notifyTaskAIReviewCompleted,
} from "@/app/services/realtime-service";

import { logger } from "@/lib/logger";


export const maxDuration = 60;

const MAX_ATTEMPTS = 5;
const STALE_LOCK_MINUTES = 3;

function isAuthorized(req: Request) {
  const expected = process.env.AI_REVIEW_WORKER_SECRET;

  if (!expected) {
    logger.error("ai_review_worker_secret_missing");
    return false;
  }

  const authorization = req.headers.get("authorization");
  if (!authorization) return false;

  const [scheme, token] = authorization.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return false;
  }

  const providedBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(expected);

  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
}

function isReviewResult(value: unknown): value is {
  overall_score: number;
  recommendation: "approve" | "request_changes" | "manual_review";
  summary: string;
  strengths: string[];
  issues: string[];
  criteria: {
    criterion: string;
    score: number;
    explanation: string;
  }[];
} {
  if (!value || typeof value !== "object") return false;

  const review = value as Record<string, unknown>;

  if (
    typeof review.overall_score !== "number" ||
    !Number.isInteger(review.overall_score) ||
    review.overall_score < 1 ||
    review.overall_score > 5
  ) return false;

  if (
    !["approve", "request_changes", "manual_review"].includes(
      String(review.recommendation)
    )
  ) return false;

  if (typeof review.summary !== "string") return false;
  if (!Array.isArray(review.strengths) ||
      !review.strengths.every((item) => typeof item === "string")) return false;
  if (!Array.isArray(review.issues) ||
      !review.issues.every((item) => typeof item === "string")) return false;

  if (!Array.isArray(review.criteria)) return false;

  return review.criteria.every((item) => {
    if (!item || typeof item !== "object") return false;

    const criterion = item as Record<string, unknown>;

    return (
      typeof criterion.criterion === "string" &&
      typeof criterion.score === "number" &&
      Number.isInteger(criterion.score) &&
      criterion.score >= 1 &&
      criterion.score <= 5 &&
      typeof criterion.explanation === "string"
    );
  });
}

async function claimNextJob() {
  const now = new Date();
  const staleBefore = new Date(
    now.getTime() - STALE_LOCK_MINUTES * 60 * 1000
  );

  return db.transaction(async (tx) => {
    // Lock one available job. SKIP LOCKED allows multiple workers
    // to process different jobs concurrently.
    const [job] = await tx
      .select({
        id: aiReviewJobs.id,
        deliverableId: aiReviewJobs.deliverableId,
        attempts: aiReviewJobs.attempts,
      })
      .from(aiReviewJobs)
      .where(
        or(
          and(
            eq(aiReviewJobs.status, "queued"),
            lte(aiReviewJobs.nextAttemptAt, now)
          ),
          and(
            eq(aiReviewJobs.status, "processing"),
            lt(aiReviewJobs.lockedAt, staleBefore)
          )
        )
      )
      .orderBy(asc(aiReviewJobs.nextAttemptAt))
      .limit(1)
      .for("update", { skipLocked: true });

    if (!job) return null;

    const nextAttempts = job.attempts + 1;

    await tx
      .update(aiReviewJobs)
      .set({
        status: "processing",
        attempts: nextAttempts,
        lockedAt: now,
        updatedAt: now,
        lastError: null,
      })
      .where(eq(aiReviewJobs.id, job.id));

    await tx
      .update(deliverables)
      .set({ aiReviewStatus: "processing" })
      .where(eq(deliverables.id, job.deliverableId));

    return {
      id: job.id,
      deliverableId: job.deliverableId,
      attempts: nextAttempts,
    };
  });
}

async function processJob(job: {
  id: number;
  deliverableId: number;
  attempts: number;
}) {
  try {
    const reviewerUrl = process.env.REVIEWER_SERVICE_URL;
    const reviewerToken = process.env.REVIEWER_SERVICE_TOKEN;

    if (!reviewerUrl || !reviewerToken) {
      throw new Error("Reviewer service environment variables are missing.");
    }

    // Load and validate the deliverable for this internal worker.
    const reviewInput = await getDeliverableForAutomaticAIReview(
      job.deliverableId
    );

    const response = await fetch(
      `${reviewerUrl.replace(/\/+$/, "")}/review`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${reviewerToken}`,
        },
        body: JSON.stringify({
          task_id: reviewInput.task_id,
          deliverable_id: reviewInput.deliverable_id,
          task_title: reviewInput.task_title,
          task_description: reviewInput.task_description,
          category: reviewInput.category,
          submission: reviewInput.submission,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(45000),
      }
    );

    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.ok || !isReviewResult(result.review)) {
      throw new Error(
        `Reviewer returned an invalid response (HTTP ${response.status}).`
      );
    }

    const now = new Date();

    // Save the structured review and complete the queue job atomically.
    await db.transaction(async (tx) => {
      await tx
        .update(deliverables)
        .set({
          aiReview: result.review,
          aiReviewStatus: "completed",
          aiReviewedAt: now,
        })
        .where(eq(deliverables.id, job.deliverableId));

      await tx
        .update(aiReviewJobs)
        .set({
          status: "completed",
          lockedAt: null,
          lastError: null,
          updatedAt: now,
        })
        .where(eq(aiReviewJobs.id, job.id));
    });

    await notifyTaskAIReviewCompleted(
      reviewInput.task_id,
      reviewInput.deliverable_id,
      reviewInput.agent_name,
      result.review
    );

    logger.info("ai_review_completed", {
      jobId: job.id,
      deliverableId: job.deliverableId,
      taskId: reviewInput.task_id,
      attempts: job.attempts,
      recommendation: result.review.recommendation,
    });

    return {
      job_id: job.id,
      deliverable_id: job.deliverableId,
      status: "completed",
      review: result.review,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    const now = new Date();
    const permanentlyFailed = job.attempts >= MAX_ATTEMPTS;

    // Exponential backoff: 1, 2, 4, 8 minutes.
    const retryDelayMinutes = Math.min(
      2 ** (job.attempts - 1),
      60
    );

    const nextAttempt = new Date(
      now.getTime() + retryDelayMinutes * 60 * 1000
    );

    await db.transaction(async (tx) => {
      await tx
        .update(aiReviewJobs)
        .set({
          status: permanentlyFailed ? "failed" : "queued",
          lockedAt: null,
          nextAttemptAt: nextAttempt,
          lastError: message.slice(0, 2000),
          updatedAt: now,
        })
        .where(eq(aiReviewJobs.id, job.id));

      await tx
        .update(deliverables)
        .set({
          aiReviewStatus: permanentlyFailed ? "failed" : "queued",
        })
        .where(eq(deliverables.id, job.deliverableId));
    });

    logger.error("ai_review_failed", {
      jobId: job.id,
      deliverableId: job.deliverableId,
      attempts: job.attempts,
      permanentlyFailed,
      error: message,
    });

    return {
      job_id: job.id,
      deliverable_id: job.deliverableId,
      status: permanentlyFailed ? "failed" : "queued_for_retry",
      error: message,
    };
  }
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const job = await claimNextJob();

    if (!job) {
      return NextResponse.json({
        ok: true,
        message: "No review jobs are currently available.",
        data: null,
      });
    }

    const result = await processJob(job);

    return NextResponse.json({
      ok: true,
      data: result,
    });
  } catch (error) {
    logger.error("ai_review_worker_error", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { ok: false, error: "AI review worker failed." },
      { status: 500 }
    );
  }
}
