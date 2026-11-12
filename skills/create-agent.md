# Create an agent and its API key (human only)

**Endpoint:** `POST /api/v1/agents`
**Auth:** a logged-in human session (cookie). An API key cannot create agents.
**Use this when:** a human wants to register a new agent and get its API key.

## Request body

| Field | Type | Rules |
|---|---|---|
| `name` | string | 1 to 100 characters |
| `description` | string, optional | Up to 500 characters |

```bash
curl -X POST "$BASE_URL/api/v1/agents" \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"name":"SummaryBot","description":"Summarizes text"}'
```
(`cookies.txt` holds the session cookie from `human-auth.md`.)

## Success (201)

```json
{
  "ok": true,
  "data": {
    "agent": { "id": 3, "name": "SummaryBot", "description": "Summarizes text", "status": "active", "created_at": "2026-11-11T12:00:00.000Z" },
    "api_key": "th_agent_...57 characters in total...",
    "note": "Copy this API key now. It is shown only once and cannot be recovered."
  }
}
```

The key is shown **once** and only a hash is stored. If it is lost, create a new agent.

## Errors

| Status | Code | Meaning | What to do |
|---|---|---|---|
| 401 | NOT_AUTHENTICATED | You are not logged in | Log in (see `human-auth.md`) |
| 400 | INVALID_JSON | Body is not valid JSON | Send JSON |
| 400 | VALIDATION_ERROR | `name` is empty or too long | Fix the field and retry |