
import os
import time
import logging
from realtime import notify_ai_review_completed
from dotenv import load_dotenv

load_dotenv()

from graph import reviewer_graph

from database import (
    claim_next_job,
    get_review_input,
    save_review,
    mark_job_failed,
)


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
)

logger = logging.getLogger("taskhive-worker")

POLL_INTERVAL = int(os.getenv("WORKER_POLL_SECONDS", "3"))



   

def process_job(job: dict) -> None:
    job_id = job["id"]
    deliverable_id = job["deliverable_id"]
    attempts = job["attempts"]

    logger.info(
        "Processing job=%s deliverable=%s attempt=%s",
        job_id,
        deliverable_id,
        attempts,
    )

    try:
        review_data = get_review_input(deliverable_id)

        # Pass only the fields expected by your existing LangGraph.
        graph_input = {
            "task_id": review_data["task_id"],
            "deliverable_id": review_data["deliverable_id"],
            "task_title": review_data["task_title"],
            "task_description": review_data["task_description"],
            "category": review_data["category"],
            "submission": review_data["submission"],
        }

        result = reviewer_graph.invoke(graph_input)
        review = result.get("review")

        if not isinstance(review, dict):
            raise ValueError("Invalid review returned by LangGraph")

        required_fields = {
            "overall_score",
            "recommendation",
            "summary",
            "strengths",
            "issues",
            "criteria",
        }

        if not required_fields.issubset(review.keys()):
            raise ValueError("Review is missing required fields")

        if review["recommendation"] not in {
            "approve",
            "request_changes",
            "manual_review",
        }:
            raise ValueError("Invalid review recommendation")

        # Save review and complete job first.
        save_review(
            job_id=job_id,
            deliverable_id=deliverable_id,
            review=review,
        )

        logger.info(
            "Review saved successfully. job=%s deliverable=%s",
            job_id,
            deliverable_id,
        )

        # Notify poster after successful database commit.
        notify_ai_review_completed(review_data, review)

    except Exception as exc:
        logger.exception(
            "Review processing failed. job=%s",
            job_id,
        )

        try:
            mark_job_failed(
                job_id=job_id,
                deliverable_id=deliverable_id,
                attempts=attempts,
                error=str(exc),
            )
        except Exception:
            logger.exception(
                "Could not update failed job status. job=%s",
                job_id,
            )
  


def run_worker():
    logger.info("======================================")
    logger.info("TASKHIVE AI REVIEW QUEUE WORKER STARTED")
    logger.info("Poll interval: %s seconds", POLL_INTERVAL)
    logger.info("======================================")

    while True:
        try:
            job = claim_next_job()

            if job is None:
                time.sleep(POLL_INTERVAL)
                continue

            process_job(job)

        except KeyboardInterrupt:
            logger.info("Worker stopped.")
            break

        except Exception:
            logger.exception("Unexpected worker error")
            time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    run_worker()
