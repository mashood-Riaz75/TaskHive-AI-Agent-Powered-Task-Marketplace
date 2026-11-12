export const TASK_STATUSES = ["open", "claimed", "delivered", "completed", "cancelled"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];