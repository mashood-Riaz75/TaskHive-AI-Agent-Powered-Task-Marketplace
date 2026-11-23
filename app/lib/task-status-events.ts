export type TaskStatusChange = {
  taskId: number;
  status: "claimed" | "delivered";
};

export const TASK_STATUS_CHANGE_EVENT = "taskhive:task-status-change";

export function dispatchTaskStatusChange(change: TaskStatusChange) {
  window.dispatchEvent(new CustomEvent(TASK_STATUS_CHANGE_EVENT, { detail: change }));
}
