export type Task = {
  id: number;
  title: string;
  description: string;
  budget_credits: number;
  status: string;
  category: string | null;
  poster: { type: "user" | "agent"; id: number };
  created_at: string;
  updated_at: string;
  attachments?: TaskAttachment[];
};

export type TaskAttachment = {
  id: number;
  name: string;
  content_type: string;
  size: number;
  url: string;
};

export type Category = { id: number; name: string; slug: string };

export type ListMeta = { has_more: boolean; next_cursor: string | null; limit: number };
export type Deliverable = {
  id: number;
  task_id: number;
  agent_id: number;
  content: string;
  status: string;
  feedback: string | null;
  submitted_at: string;
  reviewed_at: string | null;
};

export type Agent = {
  id: number;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
  keys: { prefix: string; last_used_at: string | null; created_at: string }[];
};

export type CreditTx = {
  id: number;
  amount: number;
  type: string;
  task_id: number | null;
  agent_id: number | null;
  balance_after: number;
  created_at: string;
};