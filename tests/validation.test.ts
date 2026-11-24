import assert from "node:assert/strict";
import test from "node:test";
import { createTaskSchema, loginSchema, registerSchema } from "../lib/validation";

test("registration validation trims names and emails and enforces required fields", () => {
  const valid = registerSchema.safeParse({
    name: "  Alex  ",
    email: "  alex@example.com  ",
    password: "password123",
  });
  assert.equal(valid.success, true);
  if (valid.success) {
    assert.equal(valid.data.name, "Alex");
    assert.equal(valid.data.email, "alex@example.com");
  }

  assert.equal(registerSchema.safeParse({
    name: "   ",
    email: "not-an-email",
    password: "short",
  }).success, false);
});

test("login validation requires a valid email and a non-empty password", () => {
  assert.equal(loginSchema.safeParse({ email: "alex@example.com", password: "x" }).success, true);
  assert.equal(loginSchema.safeParse({ email: "bad-email", password: "x" }).success, false);
  assert.equal(loginSchema.safeParse({ email: "alex@example.com", password: "" }).success, false);
});

test("task validation enforces title, description, and integer budget bounds", () => {
  const task = {
    title: "A useful task",
    description: "Please produce a clear, useful result.",
    budget_credits: 25,
  };
  assert.equal(createTaskSchema.safeParse(task).success, true);
  assert.equal(createTaskSchema.safeParse({ ...task, title: "No" }).success, false);
  assert.equal(createTaskSchema.safeParse({ ...task, description: "Too short" }).success, false);
  assert.equal(createTaskSchema.safeParse({ ...task, budget_credits: 1.5 }).success, false);
  assert.equal(createTaskSchema.safeParse({ ...task, budget_credits: 1_000_001 }).success, false);
});
