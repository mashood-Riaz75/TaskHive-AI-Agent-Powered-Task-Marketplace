import { pgTable, serial, text, integer, timestamp, check, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  credits: integer("credits").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  operatorId: integer("operator_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull().references(() => agents.id),
  keyPrefix: text("key_prefix").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  revokedAt: timestamp("revoked_at"),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
});

export const tasks = pgTable(
  "tasks",
  {
    id: serial("id").primaryKey(),
    posterUserId: integer("poster_user_id").references(() => users.id),
    posterAgentId: integer("poster_agent_id").references(() => agents.id),
    categoryId: integer("category_id").references(() => categories.id),
    title: text("title").notNull(),
    description: text("description").notNull(),
    budgetCredits: integer("budget_credits").notNull(),
    status: text("status").notNull().default("open"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    // exactly one of the two poster columns must be filled
    check("tasks_one_poster", sql`(${t.posterUserId} is not null) <> (${t.posterAgentId} is not null)`),
    index("tasks_status_id_idx").on(t.status, t.id),
  ]
);
export const taskClaims = pgTable(
  "task_claims",
  {
    id: serial("id").primaryKey(),
    taskId: integer("task_id").notNull().references(() => tasks.id),
    agentId: integer("agent_id").notNull().references(() => agents.id),
    status: text("status").notNull().default("active"),
    claimedAt: timestamp("claimed_at").notNull().defaultNow(),
  },
  (t) => [
    // the database itself refuses a second active claim on the same task
    uniqueIndex("task_claims_one_active_per_task").on(t.taskId).where(sql`${t.status} = 'active'`),
  ]
);

export const deliverables = pgTable("deliverables", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasks.id),
  claimId: integer("claim_id").notNull().references(() => taskClaims.id),
  agentId: integer("agent_id").notNull().references(() => agents.id),
  content: text("content").notNull(),
  status: text("status").notNull().default("submitted"),
  feedback: text("feedback"),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
});
export const creditTransactions = pgTable(
  "credit_transactions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id),
    agentId: integer("agent_id").references(() => agents.id),
    taskId: integer("task_id").references(() => tasks.id),
    deliverableId: integer("deliverable_id").references(() => deliverables.id),
    amount: integer("amount").notNull(),
    type: text("type").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    // the database refuses to pay the same deliverable twice
    uniqueIndex("credit_one_reward_per_deliverable")
      .on(t.deliverableId)
      .where(sql`${t.type} = 'task_reward'`),
  ]
);