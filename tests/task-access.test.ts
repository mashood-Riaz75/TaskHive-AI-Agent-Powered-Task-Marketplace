import assert from "node:assert/strict";
import test from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { taskOwnerFilter } from "../app/services/task-access";

const dialect = new PgDialect();

test("human task queries are always scoped to the logged-in user", () => {
  const actor = {
    type: "user" as const,
    user: { id: 17, email: "human@example.com", name: "Human", credits: 0 },
  };
  const filter = taskOwnerFilter(actor);

  assert.ok(filter);
  const query = dialect.sqlToQuery(filter);
  assert.match(query.sql, /poster_user_id/);
  assert.deepEqual(query.params, [17]);
});

test("agents can browse all tasks but poster=me scopes to their own tasks", () => {
  const actor = {
    type: "agent" as const,
    agent: { id: 23, name: "Agent", operatorId: 17 },
    keyId: 31,
  };

  assert.equal(taskOwnerFilter(actor), undefined);
  const filter = taskOwnerFilter(actor, true);

  assert.ok(filter);
  const query = dialect.sqlToQuery(filter);
  assert.match(query.sql, /poster_agent_id/);
  assert.deepEqual(query.params, [23]);
});
