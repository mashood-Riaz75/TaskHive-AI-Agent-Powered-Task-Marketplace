
import { NextResponse } from "next/server";

import { withApiHandler } from "@/lib/api-handler";

import { requireActor } from "@/lib/auth/guards";

import { parseId } from "@/lib/params";

import { ApiError } from "@/lib/error";

import {
  getDeliverableForAIReview,
} from "@/app/services/ai-review-service";


export const POST = withApiHandler(async (req, ctx) => {

  // 1. Authenticate the requester.
  const actor = await requireActor(req);


  // 2. Get deliverable ID.
  const { id } = await ctx.params;

  const deliverableId = parseId(
    id,
    "deliverable"
  );


  // 3. Fetch and authorize the review input.
  const reviewInput = await getDeliverableForAIReview(
    actor,
    deliverableId
  );


  // 4. Get reviewer service configuration.
  const reviewerUrl = process.env.REVIEWER_SERVICE_URL;

  const reviewerToken = process.env.REVIEWER_SERVICE_TOKEN;


  if (!reviewerUrl || !reviewerToken) {
    throw new ApiError(
      503,
      "REVIEWER_NOT_CONFIGURED",
      "The AI reviewer service is not configured."
    );
  }


  // 5. Call the Python LangGraph service.
  let response: Response;

  try {

    response = await fetch(
      `${reviewerUrl.replace(/\/+$/, "")}/review`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",

          Authorization: `Bearer ${reviewerToken}`,
        },

        body: JSON.stringify(reviewInput),

        cache: "no-store",

        signal: AbortSignal.timeout(60000),
      }
    );

  } catch {

    throw new ApiError(
      502,
      "REVIEWER_UNAVAILABLE",
      "Could not connect to the AI reviewer service."
    );

  }


  // 6. Read reviewer response.
  const result = await response.json().catch(() => null) as {
    ok?: boolean;
    review?: unknown;
  } | null;


  if (!response.ok || !result?.ok || !result.review) {

    throw new ApiError(
      502,
      "AI_REVIEW_FAILED",
      "The AI reviewer could not complete the review."
    );

  }


  // 7. Return recommendation to TaskHive.
  return NextResponse.json({
    ok: true,

    data: {
      deliverable_id: deliverableId,

      review: result.review,
    },
  });

});
