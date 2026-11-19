
import os
import sys
import time
import logging
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv


# ============================================================
# CONFIGURATION
# ============================================================

# Load .env from the same directory as this Python file.
BOT_DIR = Path(__file__).resolve().parent
load_dotenv(BOT_DIR / ".env")

TASKHIVE_URL = (
    os.getenv("TASKHIVE_URL") or "http://localhost:3000"
).strip().rstrip("/")

TASKHIVE_API_KEY = os.getenv("TASKHIVE_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

GROQ_MODEL = os.getenv(
    "GROQ_MODEL",
    "openai/gpt-oss-20b"
).strip()

TASKHIVE_BASE = f"{TASKHIVE_URL}/api/v1"

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

# One scheduled execution processes at most this many
# previously claimed tasks and one new task.
MAX_RECOVERED_TASKS = 3

MAX_GROQ_RETRIES = 4
MAX_API_RETRIES = 3

REQUEST_TIMEOUT = 45
GROQ_TIMEOUT = 90

MAX_GROQ_COMPLETION_TOKENS = 3000


# ============================================================
# VALIDATION
# ============================================================

if not TASKHIVE_API_KEY:
    raise RuntimeError("TASKHIVE_API_KEY is missing.")

if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY is missing.")

if not TASKHIVE_URL.startswith(("http://", "https://")):
    raise RuntimeError("TASKHIVE_URL must start with http:// or https://")


# ============================================================
# LOGGING
# ============================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

logger = logging.getLogger("taskhive-demo-bot")


# ============================================================
# HTTP CLIENTS
# ============================================================

TASKHIVE_HEADERS = {
    "Authorization": f"Bearer {TASKHIVE_API_KEY}",
    "Accept": "application/json",
    "Content-Type": "application/json",
}

taskhive_client = httpx.Client(
    headers=TASKHIVE_HEADERS,
    timeout=REQUEST_TIMEOUT,
    limits=httpx.Limits(
        max_connections=10,
        max_keepalive_connections=5,
    ),
)

groq_client = httpx.Client(
    headers={
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    },
    timeout=GROQ_TIMEOUT,
)


# ============================================================
# GENERAL HELPERS
# ============================================================

def retry_after_seconds(response: httpx.Response) -> int:
    """Read Retry-After when the server provides it."""

    value = response.headers.get("Retry-After")

    if value:
        try:
            return min(max(int(value), 1), 60)
        except ValueError:
            pass

    return 5


def response_data(response: httpx.Response) -> dict:
    """Safely extract the API response data."""

    payload = response.json()

    if not isinstance(payload, dict):
        raise RuntimeError("Unexpected API response format.")

    data = payload.get("data", {})

    if not isinstance(data, dict):
        raise RuntimeError("Unexpected API data format.")

    return data


# ============================================================
# TASKHIVE API
# ============================================================

def api_request(
    method: str,
    endpoint: str,
    *,
    json: dict | None = None,
    retry_get: bool = True,
) -> httpx.Response:
    """
    Send a request to TaskHive.

    Only GET requests are automatically retried.
    POST requests are not retried automatically because
    the server might have completed the operation already.
    """

    url = f"{TASKHIVE_BASE}{endpoint}"

    attempts = MAX_API_RETRIES if (
        method.upper() == "GET" and retry_get
    ) else 1

    for attempt in range(1, attempts + 1):
        try:
            response = taskhive_client.request(
                method=method,
                url=url,
                json=json,
            )

            if response.status_code == 429 and attempt < attempts:
                wait = retry_after_seconds(response)

                logger.warning(
                    "TaskHive rate limited request. Waiting %s seconds.",
                    wait,
                )

                time.sleep(wait)
                continue

            if response.status_code >= 500 and attempt < attempts:
                wait = min(2 ** attempt, 15)

                logger.warning(
                    "TaskHive server error %s. Retrying in %s seconds.",
                    response.status_code,
                    wait,
                )

                time.sleep(wait)
                continue

            response.raise_for_status()
            return response

        except httpx.TimeoutException:
            if attempt >= attempts:
                raise

            wait = min(2 ** attempt, 15)

            logger.warning(
                "TaskHive request timed out. Retrying in %s seconds.",
                wait,
            )

            time.sleep(wait)

        except httpx.TransportError:
            if attempt >= attempts:
                raise

            wait = min(2 ** attempt, 15)

            logger.warning(
                "TaskHive connection problem. Retrying in %s seconds.",
                wait,
            )

            time.sleep(wait)

        except httpx.HTTPStatusError:
            raise

    raise RuntimeError("TaskHive request failed.")


# ============================================================
# CONNECTION CHECK
# ============================================================

def connect_to_taskhive() -> dict:
    logger.info("Connecting to TaskHive...")

    response = api_request("GET", "/whoami")
    data = response_data(response)

    logger.info("TaskHive connection successful.")

    return data


# ============================================================
# DISCOVER OPEN TASKS
# ============================================================

def discover_tasks() -> list[dict]:
    logger.info("Discovering open tasks...")

    response = api_request(
        "GET",
        "/tasks?status=open&limit=10",
    )

    data = response_data(response)
    tasks = data.get("tasks", [])

    if not isinstance(tasks, list):
        raise RuntimeError("Invalid tasks response.")

    logger.info("Found %s open tasks.", len(tasks))

    return tasks


# ============================================================
# RECOVER PREVIOUSLY CLAIMED TASKS
# ============================================================

def discover_my_claimed_tasks() -> list[dict]:
    """
    Requires the endpoint:

    GET /api/v1/agents/me/claims

    It must return only claimed tasks belonging to this agent.
    """

    logger.info("Checking previously claimed tasks...")

    response = api_request(
        "GET",
        "/agents/me/claims",
    )

    data = response_data(response)
    claims = data.get("claims", [])

    if not isinstance(claims, list):
        raise RuntimeError("Invalid claims response.")

    logger.info(
        "Found %s previously claimed unfinished tasks.",
        len(claims),
    )

    return claims


# ============================================================
# CLAIM A TASK
# ============================================================

def claim_task(task_id: int) -> bool:
    logger.info("Attempting to claim task %s...", task_id)

    try:
        response = api_request(
            "POST",
            f"/tasks/{task_id}/claims",
            retry_get=False,
        )

        logger.info(
            "Successfully claimed task %s. HTTP %s",
            task_id,
            response.status_code,
        )

        return True

    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code

        if status in (400, 403, 404, 409):
            logger.info(
                "Cannot claim task %s. HTTP %s",
                task_id,
                status,
            )
            return False

        logger.error(
            "Claim request failed for task %s: HTTP %s",
            task_id,
            status,
        )

        raise


# ============================================================
# GET TASK DETAILS
# ============================================================

def get_task_details(task_id: int) -> dict:
    response = api_request(
        "GET",
        f"/tasks/{task_id}",
    )

    data = response_data(response)

    task = data.get("task", data)

    if not isinstance(task, dict):
        raise RuntimeError(
            f"Invalid task details response for task {task_id}."
        )

    return task


# ============================================================
# GENERATE WORK USING GROQ
# ============================================================

def generate_work(task: dict) -> str:
    task_title = task.get("title") or "Untitled task"
    task_description = task.get("description") or ""

    if not task_description.strip():
        raise RuntimeError(
            f"Task {task.get('id')} has no description."
        )

    logger.info(
        "Generating deliverable for: %s",
        task_title,
    )

    system_prompt = """
You are a professional freelance developer and task-solving assistant.

Your job is to produce a useful, complete, high-quality deliverable
based on the client's task description.

Rules:

1. Understand the client's requirements carefully.
2. Address the requested work directly.
3. Provide practical and well-organized results.
4. Include code examples when the task requires code.
5. Use Markdown formatting where appropriate.
6. Never claim that you performed real-world actions that you
   did not perform.
7. Never invent research, testing, screenshots, deployments,
   or completed external work.
8. If information is missing, state reasonable assumptions.
9. Do not simply repeat the task description.
10. Return the actual deliverable, not an explanation of how
    you would approach the task.

Produce a professional response suitable for submission
to the client.
"""

    user_prompt = f"""
TASK TITLE:
{task_title}

TASK DESCRIPTION:
{task_description}

Prepare the complete deliverable for this task.
"""

    payload = {
        "model": GROQ_MODEL,
        "messages": [
            {
                "role": "system",
                "content": system_prompt,
            },
            {
                "role": "user",
                "content": user_prompt,
            },
        ],
        "max_completion_tokens": MAX_GROQ_COMPLETION_TOKENS,
    }

    for attempt in range(1, MAX_GROQ_RETRIES + 1):
        try:
            response = groq_client.post(
                GROQ_URL,
                json=payload,
            )

            if response.status_code == 429:
                if attempt >= MAX_GROQ_RETRIES:
                    response.raise_for_status()

                wait = retry_after_seconds(response)

                logger.warning(
                    "Groq rate limit reached. Waiting %s seconds.",
                    wait,
                )

                time.sleep(wait)
                continue

            if response.status_code >= 500:
                if attempt >= MAX_GROQ_RETRIES:
                    response.raise_for_status()

                wait = min(2 ** attempt, 20)

                logger.warning(
                    "Groq server error. Retrying in %s seconds.",
                    wait,
                )

                time.sleep(wait)
                continue

            response.raise_for_status()

            result = response.json()

            choices = result.get("choices", [])

            if not choices:
                raise RuntimeError(
                    "Groq returned no completion choices."
                )

            content = (
                choices[0]
                .get("message", {})
                .get("content")
            )

            if not isinstance(content, str) or not content.strip():
                raise RuntimeError(
                    "Groq returned an empty deliverable."
                )

            logger.info("Groq successfully generated the deliverable.")

            return content.strip()

        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code

            if status in (400, 401, 403, 404):
                logger.error(
                    "Groq rejected the request. HTTP %s: %s",
                    status,
                    exc.response.text[:1000],
                )
                raise

            if attempt >= MAX_GROQ_RETRIES:
                raise

            time.sleep(min(2 ** attempt, 20))

        except (httpx.TimeoutException, httpx.TransportError):
            if attempt >= MAX_GROQ_RETRIES:
                raise

            wait = min(2 ** attempt, 20)

            logger.warning(
                "Groq connection problem. Retrying in %s seconds.",
                wait,
            )

            time.sleep(wait)

    raise RuntimeError("Unable to generate work using Groq.")


# ============================================================
# SUBMIT DELIVERABLE
# ============================================================

def submit_deliverable(task_id: int, content: str) -> bool:
    logger.info(
        "Submitting deliverable for task %s...",
        task_id,
    )

    # Do not automatically retry this POST.
    # A timeout could happen after the server has saved the
    # deliverable, so blindly retrying could create duplicates.

    response = api_request(
        "POST",
        f"/tasks/{task_id}/deliverables",
        json={
            "content": content,
        },
        retry_get=False,
    )

    logger.info(
        "Deliverable submitted successfully. Task %s, HTTP %s",
        task_id,
        response.status_code,
    )

    return True


# ============================================================
# PROCESS ONE TASK
# ============================================================

def process_task(task_id: int) -> bool:
    logger.info("Processing task %s...", task_id)

    try:
        task = get_task_details(task_id)

        status = task.get("status")

        if status in ("delivered", "completed"):
            logger.info(
                "Task %s is already %s. Skipping.",
                task_id,
                status,
            )
            return True

        if status != "claimed":
            logger.warning(
                "Task %s is not in claimed status. Current status: %s",
                task_id,
                status,
            )
            return False

        work = generate_work(task)

        return submit_deliverable(task_id, work)

    except httpx.HTTPStatusError as exc:
        logger.error(
            "Task %s API error: HTTP %s",
            task_id,
            exc.response.status_code,
        )
        return False

    except Exception:
        logger.exception(
            "Unexpected error while processing task %s.",
            task_id,
        )
        return False


# ============================================================
# MAIN: ONE EXECUTION
# ============================================================

def run_once() -> None:
    logger.info("=" * 55)
    logger.info("TASKHIVE DEMO BOT STARTED")
    logger.info("=" * 55)

    # 1. Verify connection and API key.
    connect_to_taskhive()

    # 2. Recover previously claimed unfinished tasks.
    previous_claims = discover_my_claimed_tasks()

    recovered = previous_claims[:MAX_RECOVERED_TASKS]

    for claim in recovered:
        task_id = claim.get("task_id")

        if not task_id:
            logger.warning("Skipping claim with missing task_id.")
            continue

        logger.info("Recovering task %s...", task_id)

        process_task(int(task_id))

    # 3. Find new open tasks.
    open_tasks = discover_tasks()

    # 4. Claim and process one new task.
    for task in open_tasks:
        task_id = task.get("id")

        if not task_id:
            continue

        if claim_task(int(task_id)):
            process_task(int(task_id))
            break

    logger.info("=" * 55)
    logger.info("TASKHIVE DEMO BOT FINISHED")
    logger.info("=" * 55)


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":
    try:
        run_once()

    except KeyboardInterrupt:
        logger.warning("Demo Bot stopped by user.")

    except Exception:
        logger.exception("Demo Bot execution failed.")
        sys.exit(1)

    finally:
        taskhive_client.close()
        groq_client.close()
