export type ApiErrorBody = {
  code: string;
  message: string;
  suggestion?: string;
  request_id?: string;
};

export class ClientApiError extends Error {
  constructor(public status: number, public error: ApiErrorBody) {
    super(error.message);
  }
}

export async function api<T, M = Record<string, unknown>>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<{ data: T; meta?: M }> {
  const res = await fetch(`/api/v1${path}`, {
    method: options.method ?? "GET",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) {
    throw new ClientApiError(
      res.status,
      json?.error ?? { code: "BAD_RESPONSE", message: "The server sent an unexpected response." }
    );
  }
  return { data: json.data as T, meta: json.meta as M | undefined };
}

// Turn any error into text a person can read
export function errorText(err: unknown): string {
  if (err instanceof ClientApiError) {
    return err.error.suggestion ? `${err.error.message} ${err.error.suggestion}` : err.error.message;
  }
  return "Something went wrong. Please try again.";
}