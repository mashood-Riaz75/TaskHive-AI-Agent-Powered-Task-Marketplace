
import os
import json
import time
import logging
from pathlib import Path

import httpx
from dotenv import load_dotenv


# ==================================================
# 1. CONFIGURATION
# ==================================================

load_dotenv()

TASKHIVE_URL = (
    os.getenv("TASKHIVE_URL")
    or "http://localhost:3000"
).strip().rstrip("/")

BASE = f"{TASKHIVE_URL}/api/v1"

TASKHIVE_API_KEY = os.getenv("TASKHIVE_API_KEY")
GROQ_KEY = os.getenv("GROQ_API_KEY")

MODEL = os.getenv(
    "GROQ_MODEL",
    "openai/gpt-oss-20b"
)

POLL_INTERVAL = 30
MAX_GROQ_RETRIES = 4
MAX_API_RETRIES = 3

RESUME_TASKS = (
    os.getenv("RESUME_TASKS", "true").lower() == "true"
)

STATE_FILE = Path("bot_state.json")

GROQ_URL = (
    "https://api.groq.com/openai/v1/chat/completions"
)


if not TASKHIVE_API_KEY:
    raise RuntimeError(
        "TASKHIVE_API_KEY is missing from .env"
    )

if not GROQ_KEY:
    raise RuntimeError(
        "GROQ_API_KEY is missing from .env"
    )


HEADERS = {
    "Authorization": f"Bearer {TASKHIVE_API_KEY}",
    "Content-Type": "application/json",
    "Accept": "application/json",
}

GROQ_HEADERS = {
    "Authorization": f"Bearer {GROQ_KEY}",
    "Content-Type": "application/json",
}


# ==================================================
# 2. LOGGING
# ==================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(
            "demo_bot.log",
            encoding="utf-8"
        )
    ]
)

logger = logging.getLogger("taskhive-demo-bot")


# ==================================================
# 3. HTTP CLIENT
# ==================================================

client = httpx.Client(
    timeout=httpx.Timeout(
        connect=10.0,
        read=60.0,
        write=20.0,
        pool=10.0
    ),
    limits=httpx.Limits(
        max_connections=10,
        max_keepalive_connections=5
    )
)

def api_request(method, endpoint, **kwargs):
    """Make authenticated TaskHive API requests."""

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

        try:
            return response.json()

        except ValueError:
            logger.error(
                "TaskHive returned invalid JSON: %s",
                response.text[:500]
            )
            raise

    except httpx.HTTPStatusError as exc:

        logger.error(
            "TaskHive HTTP error %s: %s",
            exc.response.status_code,
            exc.response.text[:1000]
        )

        raise

    except httpx.RequestError as exc:

        logger.error(
            "TaskHive connection error: %s",
            exc
        )

        raise


def retry_after_seconds(response):
    value = response.headers.get("Retry-After")

    try:
        return max(1, int(value))
    except (TypeError, ValueError):
        return POLL_INTERVAL


# ==================================================
# 4. PERSISTENT BOT STATE
# ==================================================

def load_state():

    default_state = {
        "pending": [],
        "completed": []
    }

    if not RESUME_TASKS:
        return default_state

    if not STATE_FILE.exists():
        return default_state

    try:

        with STATE_FILE.open(
            "r",
            encoding="utf-8"
        ) as file:

            saved_state = json.load(file)

        return {
            "pending": saved_state.get("pending", []),
            "completed": saved_state.get("completed", [])
        }

    except (
        OSError,
        json.JSONDecodeError,
        AttributeError
    ):

        logger.warning(
            "Could not load bot state. Starting fresh."
        )

        return default_state


state = load_state()


def save_state():

    if not RESUME_TASKS:
        return

    temp_file = STATE_FILE.with_suffix(".tmp")

    try:

        temp_file.write_text(
            json.dumps(state, indent=4),
            encoding="utf-8"
        )

        temp_file.replace(STATE_FILE)

    except OSError:

        logger.exception(
            "Failed to save bot state"
        )

        raise


# ==================================================
# 5. TASKHIVE CONNECTION
# ==================================================

def connect_to_taskhive():

    logger.info("Connecting to TaskHive...")

    result = api_request(
        "GET",
        "/whoami"
    )

    logger.info(
        "Authenticated successfully: %s",
        json.dumps(
            result,
            ensure_ascii=False
        )[:500]
    )

    return True


# ==================================================
# 6. TASK DISCOVERY
# ==================================================


def discover_tasks():

    result = api_request(
        "GET",
        "/tasks",
        params={
            "status": "open",
            "limit": 10
        }
    )

    if isinstance(result, dict):
        result = result.get("data", result)

    if isinstance(result, list):
        return result

    if isinstance(result, dict):

        tasks = result.get("tasks", [])

        if isinstance(tasks, list):
            return tasks

    logger.warning(
        "Unexpected task discovery response: %s",
        str(result)[:1000]
    )

    return []

    


# ==================================================
# 7. TASK CLAIMING
# ==================================================

def claim_task(task_id):

    try:

        api_request(
            "POST",
            f"/tasks/{task_id}/claims"
        )

        logger.info(
            "Successfully claimed task %s",
            task_id
        )

        return True

    except httpx.HTTPStatusError as exc:

        status = exc.response.status_code

        if status in (400, 409):

            logger.warning(
                "Task %s is no longer claimable",
                task_id
            )

            return False

        raise


# ==================================================
# 8. TASK DETAILS
# ==================================================

def get_task_details(task_id):

    result = api_request(
        "GET",
        f"/tasks/{task_id}"
    )

    if not isinstance(result, dict):
        raise ValueError(
            "Invalid task details response"
        )

    task = result.get("task", result)

    if not isinstance(task, dict):
        raise ValueError(
            "Task details are missing"
        )

    return task


# ==================================================
# 10. GROQ TASK GENERATION
# ==================================================

def generate_work(task):

    title = task.get(
        "title",
        "Untitled task"
    )

    description = task.get(
        "description",
        ""
    )

    requirements = task.get(
        "requirements",
        ""
    )

    instructions = task.get(
        "instructions",
        ""
    )

    acceptance_criteria = task.get(
        "acceptance_criteria",
        ""
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
7. Do not claim that external actions were performed
   unless they actually were.
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

            if not isinstance(content, str):
                raise ValueError(
                    "Groq returned invalid content"
                )

            content = content.strip()

            if not content:
                raise ValueError(
                    "Groq returned empty content"
                )

            logger.info(
                "Work generated successfully"
            )

            return content

        except (
            httpx.TimeoutException,
            httpx.RequestError,
            httpx.HTTPStatusError,
            ValueError,
            KeyError,
            IndexError,
            TypeError
        ) as exc:

            if isinstance(
                exc,
                httpx.HTTPStatusError
            ):

                status = exc.response.status_code

                if status in (400, 401, 403, 404):

                    logger.error(
                        "Non-retryable Groq error: %s",
                        exc.response.text[:500]
                    )

                    raise

            if attempt == MAX_GROQ_RETRIES - 1:

                logger.exception(
                    "Groq failed after all retries"
                )

                raise

            delay = min(
                2 ** attempt,
                30
            )

            logger.warning(
                "Groq attempt %s failed: %s. "
                "Retrying in %s seconds.",
                attempt + 1,
                exc,
                delay
            )

            time.sleep(delay)


# ==================================================
# 11. DELIVERABLE SUBMISSION
# ==================================================

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
        json.dumps(
            result,
            ensure_ascii=False
        )[:500]
    )

    return result


# ==================================================
# 12. TASK PROCESSING
# ==================================================

def process_task(task_id):

    logger.info(
        "Processing task %s",
        task_id
    )

    try:

        task = get_task_details(task_id)

        # A delivered task is finished from this bot's perspective; its
        # delivery may belong to another agent.
        if task.get("status") in {"delivered", "completed"}:
            logger.warning(
                "Skipping task %s because its status is '%s'.",
                task_id,
                task.get("status")
            )
            return True

        # Generate work through Groq.
        work = generate_work(task)

        if not work:
            raise ValueError(
                "Generated work is empty"
            )

        # Submit completed deliverable.
        submit_deliverable(
            task_id,
            work
        )

        logger.info(
            "Task %s completed successfully",
            task_id
        )

        return True

    except httpx.HTTPStatusError as exc:

        if exc.response.status_code == 429:
            raise

        logger.exception(
            "Failed to process task %s",
            task_id
        )

        return False

    except Exception:

        logger.exception(
            "Failed to process task %s",
            task_id
        )

        return False


# ==================================================
# 13. TASK STATE MANAGEMENT
# ==================================================

def mark_task_completed(task_id):

    if task_id in state["pending"]:
        state["pending"].remove(task_id)

    if task_id not in state["completed"]:
        state["completed"].append(task_id)

    save_state()


# ==================================================
# 14. MAIN BOT LOOP
# ==================================================

def run_bot():

    logger.info(
        "Starting TaskHive Demo Bot"
    )

    logger.info(
        "TaskHive server: %s",
        TASKHIVE_URL
    )

    logger.info(
        "Groq model: %s",
        MODEL
    )

    # ----------------------------------------------
    # Connect to TaskHive
    # ----------------------------------------------

    while True:

        try:

            connect_to_taskhive()

            break

        except httpx.RequestError:

            logger.exception(
                "TaskHive unavailable. "
                "Retrying in 30 seconds..."
            )

            time.sleep(30)

        except httpx.HTTPStatusError as exc:

            status = exc.response.status_code

            if status == 429:
                retry_after = retry_after_seconds(exc.response)
                logger.warning(
                    "TaskHive rate limit exceeded. "
                    "Retrying in %s seconds.",
                    retry_after
                )
                time.sleep(retry_after)
                continue

            if status in (401, 403):
                logger.critical(
                    "TaskHive authentication failed. "
                    "Check TASKHIVE_API_KEY."
                )
                raise

            logger.exception(
                "TaskHive connection failed. "
                "Retrying in 30 seconds..."
            )

            time.sleep(30)

    # ----------------------------------------------
    # Continuous polling
    # ----------------------------------------------

    while True:

        try:

            # Resume previously claimed tasks.
            for task_id in list(state["pending"]):

                if task_id in state["completed"]:

                    state["pending"].remove(task_id)
                    save_state()

                    continue

                success = process_task(task_id)

                if success:
                    mark_task_completed(task_id)

            # Discover new tasks.
            tasks = discover_tasks()

            logger.info(
                "Discovered %s open tasks",
                len(tasks)
            )

            # Process one new task per polling cycle.
            for task in tasks:

                if not isinstance(task, dict):
                    continue

                task_id = str(
                    task.get("id", "")
                )

                if not task_id:

                    logger.warning(
                        "Skipping task without ID"
                    )

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
                        mark_task_completed(task_id)

                    break

        except httpx.RequestError:

            logger.exception(
                "TaskHive connection problem"
            )

        except httpx.HTTPStatusError as exc:

            if exc.response.status_code == 429:
                retry_after = retry_after_seconds(exc.response)
                logger.warning(
                    "TaskHive rate limit exceeded. "
                    "Retrying in %s seconds.",
                    retry_after
                )
                time.sleep(retry_after)
                continue

            logger.exception(
                "TaskHive returned HTTP %s",
                exc.response.status_code
            )

        except Exception:

            logger.exception(
                "Unexpected error in main bot loop"
            )

        logger.info(
            "Next polling cycle in %s seconds",
            POLL_INTERVAL
        )

        time.sleep(POLL_INTERVAL)


# ==================================================
# 15. ENTRY POINT
# ==================================================

if __name__ == "__main__":

    try:

        run_bot()

    except KeyboardInterrupt:

        logger.info(
            "Demo Bot stopped by user"
        )

    finally:

        client.close()

        logger.info(
            "HTTP client closed"
        )
