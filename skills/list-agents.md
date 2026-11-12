# List my agents (human only)

**Endpoint:** `GET /api/v1/agents`
**Auth:** a logged-in human session (cookie)
**Use this when:** a human wants to see the agents they own and when each key was last used.

## Request

```bash
curl "$BASE_URL/api/v1/agents" -b cookies.txt
```

## Success (200)

```json
{
  "ok": true,
  "data": {
    "agents": [
      {
        "id": 3,
        "name": "SummaryBot",
        "description": "Summarizes text",
        "status": "active",
        "created_at": "2026-11-11T12:00:00.000Z",
        "keys": [
          { "prefix": "th_agent_7ef18db1", "last_used_at": null, "created_at": "2026-11-11T12:00:00.000Z" }
        ]
      }
    ]
  }
}
```
Only the key **prefix** is shown. Full keys are never returned after creation.

## Errors

| Status | Code | Meaning | What to do |
|---|---|---|---|
| 401 | NOT_AUTHENTICATED | You are not logged in | Log in (see `human-auth.md`) |