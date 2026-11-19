
import os
import json
import time
import logging
from pathlib import Path

import httpx
from dotenv import load_dotenv

# --------------------------------------------------
# CONFIGURATION
# --------------------------------------------------

load_dotenv()

TASKHIVE_URL = os.getenv(
    "TASKHIVE_URL",
    "http://localhost:3000"
).rstrip("/")

BASE = TASKHIVE_URL + "/api/v1"

TASKHIVE_API_KEY = os.getenv("TASKHIVE_API_KEY")
GROQ_KEY = os.getenv("GROQ_API_KEY")

MODEL = os.getenv(
    "GROQ_MODEL",
    "openai/gpt-oss-20b"
)

POLL_INTERVAL = 15
MAX_GROQ_RETRIES = 4

RESUME_TASKS = os.getenv(
    "RESUME_TASKS", "true"
).lower() == "true"

STATE_FILE = Path("bot_state.json")

if not TASKHIVE_API_KEY:
    raise RuntimeError("TASKHIVE_API_KEY is missing")

if not GROQ_KEY:
    raise RuntimeError("GROQ_API_KEY is missing")

HEADERS = {
    "Authorization": f"Bearer {TASKHIVE_API_KEY}",
    "Content-Type": "application/json",
    "Accept": "application/json",
}

GROQ_URL = (
    "https://api.groq.com/openai/v1/chat/completions"
)

GROQ_HEADERS = {
    "Authorization": f"Bearer {GROQ_KEY}",
    "Content-Type": "application/json",
}

# --------------------------------------------------
# LOGGING
# --------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)

logger = logging.getLogger("taskhive-demo-bot")

# --------------------------------------------------
# HTTP CLIENT
# --------------------------------------------------

client = httpx.Client(timeout=30.0)

def api_request(method, endpoint, **kwargs):
    """Make a TaskHive API request with error handling."""

    url = f"{BASE}{endpoint}"

    try:
        response = client.request(
            method,
            url,
            headers=HEADERS,
            **kwargs
        )

        response.raise_for_status()

        if not response.content:
            return {}

        return response.json()

    except httpx.HTTPStatusError as exc:
        logger.error(
            "TaskHive HTTP error %s: %s",
            exc.response.status_code,
            exc.response.text[:1000]
        )
        raise

    except httpx.RequestError as exc:
        logger.error("TaskHive connection error: %s", exc)
        raise

    except ValueError as exc:
        logger.error("Invalid TaskHive JSON response: %s", exc)
        raise

# --------------------------------------------------
# PERSISTENT BOT STATE
# --------------------------------------------------

def load_state():
    if not RESUME_TASKS:
        return {"pending": [], "completed": []}

    if not STATE_FILE.exists():
        return {"pending": [], "completed": []}

    try:
        with STATE_FILE.open("r", encoding="utf-8") as file:
            state = json.load(file)

        return {
            "pending": state.get("pending", []),
            "completed": state.get("completed", [])
        }

    except (OSError, json.JSONDecodeError):
        logger.warning("Could not read bot state. Starting fresh.")
        return {"pending": [], "completed": []}

def save_state():
    if not RESUME_TASKS:
        return

    temp_file = STATE_FILE.with_suffix(".tmp")

    temp_file.write_text(
        json.dumps(state, indent=4),
        encoding="utf-8"
    )

    temp_file.replace(STATE_FILE)

state = load_state()

# --------------------------------------------------
# TASKHIVE CONNECTION
# --------------------------------------------------

def connect_to_taskhive():
    logger.info("Connecting to TaskHive...")

    result = api_request("GET", "/whoami")

    logger.info(
        "Authenticated successfully: %s",
        json.dumps(result, ensure_ascii=False)[:500]
    )

# --------------------------------------------------
# TASK DISCOVERY
# --------------------------------------------------

def discover_tasks():
    result = api_request(
        "GET",
        "/tasks",
        params={
            "status": "open",
            "limit": 10
        }
    )

    if isinstance(result, list):
        return result

    return result.get("tasks", [])

# --------------------------------------------------
# TASK CLAIMING
# --------------------------------------------------

def claim_task(task_id):
    try:
        result = api_request(
            "POST",
            f"/tasks/{task_id}/claims"
        )

        logger.info("Claimed task %s", task_id)
        return True

    except httpx.HTTPStatusError as exc:
        if exc.response.status_code in (400, 409):
            logger.warning(
                "Task %s is no longer claimable",
                task_id
            )
            return False

        raise

# --------------------------------------------------
# TASK DETAILS
# --------------------------------------------------

def get_task_details(task_id):
    result = api_request(
        "GET",
        f"/tasks/{task_id}"
    )

    return result.get("task", result)

def get_task_deliverables(task_id):
    result = api_request(
        "GET",
        f"/tasks/{task_id}/deliverables"
    )

    if isinstance(result, list):
        return result

    return result.get("deliverables", [])

# --------------------------------------------------
# EXISTING SUBMISSION CHECK
# --------------------------------------------------

def inspect_existing_deliverables(task_id):
    deliverables = get_task_deliverables(task_id)

    if not deliverables:
        return False

    for item in deliverables:
        status = str(
            item.get("status", "")
        ).lower()

        if status in {
            "rejected",
            "approved",
            "submitted",
            "pending",
            "in_review"
        }:
            feedback = (
                item.get("feedback")
                or item.get("review_feedback")
                or ""
            )

            logger.warning(
                "Existing deliverable found for task %s. "
                "Status: %s. Feedback: %s",
                task_id,
                status,
                str(feedback)[:500]
            )

            return True

    return False

# --------------------------------------------------
# GROQ TASK GENERATION
# --------------------------------------------------

def generate_work(task):
    title = task.get("title", "Untitled task")

    description = task.get("description", "")

    requirements = task.get("requirements", "")

    instructions = task.get("instructions", "")

    acceptance_criteria = task.get(
        "acceptance_criteria", ""
    )

    task_context = f"""
TASK TITLE:
{title}

DESCRIPTION:
{description}

REQUIREMENTS:
{requirements}

INSTRUCTIONS:
{instructions}

ACCEPTANCE CRITERIA:
{acceptance_criteria}
"""

    messages = [
        {
            "role": "system",
            "content": """
You are a professional autonomous task-solving agent.

Your responsibility is to produce high-quality,
complete and accurate deliverables.

Rules:
1. Follow the task requirements carefully.
2. Do not invent facts or claim unperformed work.
3. Use a clear and professional structure.
4. Address every requirement.
5. If information is missing, explicitly state
   reasonable assumptions.
6. Return only the final deliverable.
"""
        },
        {
            "role": "user",
            "content": (
                "Complete the following task:\n\n"
                + task_context
            )
        }
    ]

    payload = {
        "model": MODEL,
        "temperature": 0.3,
        "messages": messages
    }

    for attempt in range(MAX_GROQ_RETRIES):
        try:
            response = httpx.post(
                GROQ_URL,
                headers=GROQ_HEADERS,
                json=payload,
                timeout=90.0
            )

            response.raise_for_status()

            result = response.json()

            content = (
                result["choices"][0]
                ["message"]["content"]
            )

            if not content or not content.strip():
                raise ValueError("Groq returned empty content")

            logger.info("Work generated successfully")

            return content.strip()

        except (
            httpx.TimeoutException,
            httpx.RequestError,
            httpx.HTTPStatusError,
            ValueError,
            KeyError,
            IndexError
        ) as exc:

            if isinstance(exc, httpx.HTTPStatusError):
                status = exc.response.status_code

                # Do not retry authentication or invalid-request errors.
                if status in (400, 401, 403, 404):
                    logger.error(
                        "Non-retryable Groq error: %s",
                        exc.response.text[:500]
                    )
                    raise

            if attempt == MAX_GROQ_RETRIES - 1:
                logger.error(
                    "Groq failed after all retries: %s",
                    exc
                )
                raise

            delay = min(2 ** attempt, 30)

            logger.warning(
                "Groq attempt %s failed: %s. "
                "Retrying in %s seconds.",
                attempt + 1,
                exc,
                delay
            )

            time.sleep(delay)

# --------------------------------------------------
# DELIVERABLE SUBMISSION
# --------------------------------------------------

def submit_deliverable(task_id, work):
    result = api_request(
        "POST",
        f"/tasks/{task_id}/deliverables",
        json={
            "content": work
        }
    )

    logger.info(
        "Deliverable submitted for task %s: %s",
        task_id,
        json.dumps(result, ensure_ascii=False)[:500]
    )

    return result

# --------------------------------------------------
# TASK PROCESSING
# --------------------------------------------------

def process_task(task_id):

    logger.info("Processing task %s", task_id)

    try:
        task = get_task_details(task_id)

        if inspect_existing_deliverables(task_id):
            logger.warning(
                "Skipping task %s because a deliverable "
                "already exists. Review it manually if rejected.",
                task_id
            )

            return True

        work = generate_work(task)

        submit_deliverable(task_id, work)

        logger.info(
            "Task %s completed successfully",
            task_id
        )

        return True

    except Exception:
        logger.exception(
            "Failed to process task %s",
            task_id
        )

        return False

# --------------------------------------------------
# MAIN BOT LOOP
# --------------------------------------------------

def run_bot():

    logger.info("Starting TaskHive Demo Bot")

    connect_to_taskhive()

    while True:

        try:
            # Resume previously claimed tasks first.
            for task_id in list(state["pending"]):

                if task_id in state["completed"]:
                    state["pending"].remove(task_id)
                    save_state()
                    continue

                success = process_task(task_id)

                if success:
                    state["pending"].remove(task_id)

                    if task_id not in state["completed"]:
                        state["completed"].append(task_id)

                    save_state()

            # Discover new tasks.
            tasks = discover_tasks()

            logger.info(
                "Discovered %s open tasks",
                len(tasks)
            )

            for task in tasks:

                task_id = str(task.get("id", ""))

                if not task_id:
                    logger.warning("Skipping task without ID")
                    continue

                if (
                    task_id in state["pending"]
                    or task_id in state["completed"]
                ):
                    continue

                logger.info(
                    "Attempting to claim task %s",
                    task_id
                )

                if claim_task(task_id):

                    state["pending"].append(task_id)
                    save_state()

                    success = process_task(task_id)

                    if success:
                        state["pending"].remove(task_id)
                        state["completed"].append(task_id)
                        save_state()

                    # One new task per polling cycle.
                    break

        except Exception:
            logger.exception(
                "Unexpected error in main bot loop"
            )

        logger.info(
            "Next polling cycle in %s seconds",
            POLL_INTERVAL
        )

        time.sleep(POLL_INTERVAL)

# --------------------------------------------------
# ENTRY POINT
# --------------------------------------------------

if __name__ == "__main__":

    try:
        run_bot()

    except KeyboardInterrupt:
        logger.info("Demo Bot stopped by user")

    finally:
        client.close()