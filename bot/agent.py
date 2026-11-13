import os
import time
import httpx

BASE = os.environ.get("TASKHIVE_URL", "http://localhost:3000") + "/api/v1"
HEADERS = {"Authorization": f"Bearer {os.environ['TASKHIVE_API_KEY']}"}
GROQ_KEY = os.environ["GROQ_API_KEY"]
MODEL = os.environ.get("GROQ_MODEL", "openai/gpt-oss-20b")
SYSTEM = ("You complete tasks posted on a freelance marketplace. "
          "Reply with ONLY the finished work, in plain text or markdown, with no preamble.")

# Tasks this agent has claimed and not finished.
# After a restart, resume earlier ones with: $env:RESUME_TASKS = "2"
my_tasks = {int(x) for x in os.environ.get("RESUME_TASKS", "").split(",") if x}


def call(method, path, **kwargs):
    r = httpx.request(method, BASE + path, headers=HEADERS, timeout=30, **kwargs)
    return r.status_code, r.json()


def ask_llm(prompt):
    r = httpx.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {GROQ_KEY}"},
        json={"model": MODEL, "temperature": 0.4,
              "messages": [{"role": "system", "content": SYSTEM},
                           {"role": "user", "content": prompt}]},
        timeout=60,
    )
    if r.status_code != 200:
        raise RuntimeError(f"Groq {r.status_code}: {r.text[:300]}")
    text = (r.json()["choices"][0]["message"].get("content") or "").strip()
    if not text:
        raise RuntimeError("The model returned empty text")
    return text


def claim_one_task():
    status, body = call("GET", "/tasks", params={"status": "open", "limit": 10})
    if status != 200:
        print("could not list tasks:", body["error"]["message"])
        return
    for task in body["data"]["tasks"]:
        s, b = call("POST", f"/tasks/{task['id']}/claims")
        if s == 201:
            print(f"claimed task {task['id']}: {task['title']}")
            my_tasks.add(task["id"])
            return
        print(f"skipped task {task['id']}: {b['error']['code']}")


def work_on_my_tasks():
    for task_id in list(my_tasks):
        s, b = call("GET", f"/tasks/{task_id}")
        if s != 200:
            continue
        task = b["data"]["task"]
        if task["status"] == "completed":
            print(f"task {task_id} was ACCEPTED. Credits earned: {task['budget_credits']}")
            my_tasks.discard(task_id)
            continue
        if task["status"] != "claimed":
            continue  # delivered and waiting for the poster's review

        # No deliveries yet gives a 403, which we treat as an empty history
        s, b = call("GET", f"/tasks/{task_id}/deliverables")
        history = b["data"]["deliverables"] if s == 200 else []

        if not history:
            prompt = f"Title: {task['title']}\n\nInstructions:\n{task['description']}"
        else:
            last = history[0]  # newest first
            prompt = (f"Title: {task['title']}\n\nInstructions:\n{task['description']}\n\n"
                      f"Your previous work was REJECTED.\nPrevious work:\n{last['content']}\n\n"
                      f"Poster feedback: {last['feedback']}\n\nWrite an improved version.")
        try:
            work = ask_llm(prompt)
        except Exception as e:  # for example a Groq rate limit
            print("LLM error, will retry next round:", e)
            continue

        s, b = call("POST", f"/tasks/{task_id}/deliverables", json={"content": work})
        print(f"delivered task {task_id}" if s == 201 else f"deliver failed: {b['error']}")


if __name__ == "__main__":
    s, b = call("GET", "/whoami")
    if s != 200:
        raise SystemExit(f"Bad API key: {b}")
    print("running as agent:", b["data"]["name"])
    while True:
        if not my_tasks:  # work on one task at a time, never hog tasks
            claim_one_task()
        work_on_my_tasks()
        time.sleep(15)