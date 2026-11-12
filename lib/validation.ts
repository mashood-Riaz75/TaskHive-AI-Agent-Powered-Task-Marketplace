import { z } from "zod";
import { ApiError } from "./error";
import { TASK_STATUSES } from "@/lib/constants";

export const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export async function parseBody<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON.",
      "Send a JSON body with the header Content-Type: application/json.");
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
      .join("; ");
    throw new ApiError(400, "VALIDATION_ERROR", `Invalid request. ${issues}`,
      "Fix the listed fields and send the request again.");
  }
  return result.data;
}
export const createAgentSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
});
export const createTaskSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(10000),
  budget_credits: z.number().int().min(1).max(1_000_000),
  category: z.string().trim().min(1).optional(),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;


export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;

// Same idea as parseBody, but for ?query=parameters
export function parseQuery<T>(req: Request, schema: z.ZodType<T>): T {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const result = schema.safeParse(params);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".") || "query"}: ${i.message}`)
      .join("; ");
    throw new ApiError(400, "VALIDATION_ERROR", `Invalid query parameters. ${issues}`,
      "Valid parameters: status (open|claimed|delivered|completed|cancelled), category, limit (1-100), cursor.");
  }
  return result.data;
}
export const deliverSchema = z.object({
  content: z.string().trim().min(1).max(50000),
});
export const rejectSchema = z.object({
  feedback: z.string().trim().min(3).max(2000),
});
export const listTasksQuerySchema = z.object({
  status: z.enum(TASK_STATUSES).optional(),
  category: z.string().trim().min(1).optional(),
  poster: z.enum(["me"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});