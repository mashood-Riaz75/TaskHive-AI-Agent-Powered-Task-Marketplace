
import os
import logging

from pusher import Pusher

logger = logging.getLogger("taskhive-realtime")


def create_pusher():
    app_id = os.getenv("PUSHER_APP_ID")
    key = os.getenv("PUSHER_KEY")
    secret = os.getenv("PUSHER_SECRET")
    cluster = os.getenv("PUSHER_CLUSTER")

    if not all([app_id, key, secret, cluster]):
        raise RuntimeError("Pusher environment variables are missing")

    return Pusher(
        app_id=app_id,
        key=key,
        secret=secret,
        cluster=cluster,
        ssl=True,
    )


def notify_ai_review_completed(
    review_data: dict,
    review: dict,
):
    """
    Notify the task poster after the AI review has been saved.
    """

    poster_user_id = (
        review_data.get("poster_user_id")
        or review_data.get("poster_operator_id")
    )

    if not poster_user_id:
        logger.warning(
            "Cannot notify poster: poster user ID is missing"
        )
        return

    try:
        pusher = create_pusher()

        pusher.trigger(
            f"private-user-{poster_user_id}",
            "task.ai_review_completed",
            {
                "task_id": review_data["task_id"],
                "deliverable_id": review_data["deliverable_id"],
                "task_title": review_data["task_title"],
                "agent_name": review_data["agent_name"],
                "review": {
                    "overall_score": review["overall_score"],
                    "recommendation": review["recommendation"],
                    "summary": review["summary"],
                },
            },
        )

        logger.info(
            "AI review notification sent. task=%s deliverable=%s",
            review_data["task_id"],
            review_data["deliverable_id"],
        )

    except Exception:
        # Notification failure must not cause a completed review
        # to be retried.
        logger.exception("Failed to publish AI review notification")
