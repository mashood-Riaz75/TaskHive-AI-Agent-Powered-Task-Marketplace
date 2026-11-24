
import os
import logging
from typing import Any

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = int(os.getenv("MAX_REVIEW_ATTEMPTS", "5"))


def get_connection():
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        raise RuntimeError("DATABASE_URL is not configured")

    return psycopg.connect(
        database_url,
        row_factory=dict_row,
        connect_timeout=10,
    )


def claim_next_job() -> dict[str, Any] | None:
    """
    Atomically claim one available review job.

    SKIP LOCKED allows multiple worker instances to process
    different jobs without claiming the same job.
    """

    with get_connection() as conn:
        with conn.cursor() as cur:

            # Permanently fail stale jobs that exhausted their attempts.
            cur.execute(
                """
                UPDATE ai_review_jobs
                SET
                    status = 'failed',
                    locked_at = NULL,
                    last_error = COALESCE(
                        last_error,
                        'Maximum attempts reached after worker interruption'
                    ),
                    updated_at = NOW()
                WHERE
                    status = 'processing'
                    AND locked_at < NOW() - INTERVAL '3 minutes'
                    AND attempts >= %s
                RETURNING deliverable_id
                """,
                (MAX_ATTEMPTS,),
            )

            exhausted = cur.fetchall()

            for item in exhausted:
                cur.execute(
                    """
                    UPDATE deliverables
                    SET ai_review_status = 'failed'
                    WHERE id = %s
                    """,
                    (item["deliverable_id"],),
                )

            # Claim one queued job or reclaim a stale processing job.
            cur.execute(
                """
                WITH next_job AS (
                    SELECT id
                    FROM ai_review_jobs
                    WHERE
                        attempts < %s
                        AND (
                            (
                                status = 'queued'
                                AND next_attempt_at <= NOW()
                            )
                            OR
                            (
                                status = 'processing'
                                AND locked_at < NOW() - INTERVAL '3 minutes'
                            )
                        )
                    ORDER BY next_attempt_at ASC, id ASC
                    LIMIT 1
                    FOR UPDATE SKIP LOCKED
                )
                UPDATE ai_review_jobs AS job
                SET
                    status = 'processing',
                    attempts = job.attempts + 1,
                    locked_at = NOW(),
                    last_error = NULL,
                    updated_at = NOW()
                FROM next_job
                WHERE job.id = next_job.id
                RETURNING
                    job.id,
                    job.deliverable_id,
                    job.attempts
                """,
                (MAX_ATTEMPTS,),
            )

            job = cur.fetchone()

            if job:
                cur.execute(
                    """
                    UPDATE deliverables
                    SET ai_review_status = 'processing'
                    WHERE id = %s
                    """,
                    (job["deliverable_id"],),
                )

            return job



def get_review_input(deliverable_id: int) -> dict:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    t.id AS task_id,
                    d.id AS deliverable_id,
                    t.title AS task_title,
                    t.description AS task_description,
                    c.slug AS category,
                    d.content AS submission,

                    t.poster_user_id AS poster_user_id,
                    poster_agent.operator_id AS poster_operator_id,

                    submitting_agent.name AS agent_name

                FROM deliverables d

                INNER JOIN tasks t
                    ON t.id = d.task_id

                LEFT JOIN categories c
                    ON c.id = t.category_id

                LEFT JOIN agents poster_agent
                    ON poster_agent.id = t.poster_agent_id

                INNER JOIN agents submitting_agent
                    ON submitting_agent.id = d.agent_id

                WHERE
                    d.id = %s
                    AND d.status = 'submitted'
                    AND t.status = 'delivered'

                LIMIT 1
                """,
                (deliverable_id,),
            )

            result = cur.fetchone()

            if not result:
                raise ValueError(
                    f"Deliverable {deliverable_id} is missing "
                    "or is not eligible for AI review"
                )

            return result



def save_review(
    job_id: int,
    deliverable_id: int,
    review: dict[str, Any],
) -> None:
    """
    Save the review and complete the queue job atomically.
    """

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE deliverables
                SET
                    ai_review = %s,
                    ai_review_status = 'completed',
                    ai_reviewed_at = NOW()
                WHERE id = %s
                """,
                (Jsonb(review), deliverable_id),
            )

            cur.execute(
                """
                UPDATE ai_review_jobs
                SET
                    status = 'completed',
                    locked_at = NULL,
                    last_error = NULL,
                    updated_at = NOW()
                WHERE id = %s
                """,
                (job_id,),
            )


def mark_job_failed(
    job_id: int,
    deliverable_id: int,
    attempts: int,
    error: str,
) -> None:
    """
    Retry with exponential backoff, or permanently fail after
    MAX_ATTEMPTS.
    """

    failed_permanently = attempts >= MAX_ATTEMPTS

    retry_minutes = min(60, 2 ** (attempts - 1))

    with get_connection() as conn:
        with conn.cursor() as cur:

            if failed_permanently:
                cur.execute(
                    """
                    UPDATE ai_review_jobs
                    SET
                        status = 'failed',
                        locked_at = NULL,
                        last_error = %s,
                        updated_at = NOW()
                    WHERE id = %s
                    """,
                    (error[:2000], job_id),
                )

                cur.execute(
                    """
                    UPDATE deliverables
                    SET ai_review_status = 'failed'
                    WHERE id = %s
                    """,
                    (deliverable_id,),
                )

            else:
                cur.execute(
                    """
                    UPDATE ai_review_jobs
                    SET
                        status = 'queued',
                        next_attempt_at =
                            NOW() + make_interval(mins => %s),
                        locked_at = NULL,
                        last_error = %s,
                        updated_at = NOW()
                    WHERE id = %s
                    """,
                    (retry_minutes, error[:2000], job_id),
                )

                cur.execute(
                    """
                    UPDATE deliverables
                    SET ai_review_status = 'queued'
                    WHERE id = %s
                    """,
                    (deliverable_id,),
                )
