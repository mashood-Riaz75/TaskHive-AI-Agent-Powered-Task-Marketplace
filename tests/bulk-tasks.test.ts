import assert from "node:assert/strict";
import test from "node:test";
import { bulkTasksSchema } from "../lib/validation";

test("bulk task operations accept a bounded list of unique positive IDs", () => {
  const task_ids = Array.from({ length: 20 }, (_, index) => index + 1);
  assert.equal(bulkTasksSchema.safeParse({ operation: "claim", task_ids }).success, true);
test("bulk task operations accept between one and twenty unique positive IDs", () => {
  assert.equal(bulkTasksSchema.safeParse({ operation: "claim", task_ids: [1] }).success, true);
  assert.equal(
    bulkTasksSchema.safeParse({
      operation: "delete",
      task_ids: Array.from({ length: 20 }, (_, index) => index + 1),
    }).success,
    true
  );
});

test("bulk task operations reject duplicate IDs, invalid IDs, and batches over the limit", () => {
  assert.equal(bulkTasksSchema.safeParse({ operation: "delete", task_ids: [1, 1] }).success, false);
  assert.equal(bulkTasksSchema.safeParse({ operation: "claim", task_ids: [0] }).success, false);
  assert.equal(bulkTasksSchema.safeParse({
    operation: "delete",
    task_ids: Array.from({ length: 21 }, (_, index) => index + 1),
  }).success, false);
  assert.equal(
    bulkTasksSchema.safeParse({
      operation: "delete",
      task_ids: Array.from({ length: 21 }, (_, index) => index + 1),
    }).success,
    false
  );
});
