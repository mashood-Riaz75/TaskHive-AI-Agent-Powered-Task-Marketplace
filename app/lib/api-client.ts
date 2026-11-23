
export type ApiErrorBody = {
  code: string;
  message: string;
  suggestion?: string;
  request_id?: string;
};

export class ClientApiError extends Error {
  constructor(
    public status: number,
    public error: ApiErrorBody,
    public retryAfterSeconds?: number
  ) {
    super(error.message);
    this.name = "ClientApiError";
  }
}

function getRetryAfterSeconds(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);

  const retryAt = Date.parse(value);
  return Number.isNaN(retryAt)
    ? undefined
    : Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
}

type ApiOptions = {
  method?: string;
  body?: unknown;
};

export async function api<T, M = Record<string, unknown>>(
  path: string,
  options: ApiOptions = {}
): Promise<{ data: T; meta?: M }> {
  const isFormData =
    typeof FormData !== "undefined" &&
    options.body instanceof FormData;

  let requestBody: BodyInit | undefined;

  if (options.body !== undefined && options.body !== null) {
    if (
      typeof FormData !== "undefined" &&
      options.body instanceof FormData
    ) {
      requestBody = options.body;
    } else {
      requestBody = JSON.stringify(options.body);
    }
  }

  const res = await fetch(`/api/v1${path}`, {
    method: options.method ?? "GET",
    headers:
      options.body !== undefined && options.body !== null && !isFormData
        ? { "Content-Type": "application/json" }
        : undefined,
    body: requestBody,
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);

  if (!res.ok || !json?.ok) {
    throw new ClientApiError(
      res.status,
      json?.error ?? {
        code: "BAD_RESPONSE",
        message: "The server sent an unexpected response.",
      },
      getRetryAfterSeconds(res.headers.get("retry-after"))
    );
  }

  return {
    data: json.data as T,
    meta: json.meta as M | undefined,
  };
}

// Turn any error into text a person can read
export function errorText(err: unknown): string {
  if (err instanceof ClientApiError) {
    if (err.status === 429 && err.retryAfterSeconds !== undefined) {
      const seconds = err.retryAfterSeconds;
      return `${err.error.message} Retry in ${seconds} second${seconds === 1 ? "" : "s"}.`;
    }
    return err.error.suggestion
      ? `${err.error.message} ${err.error.suggestion}`
      : err.error.message;
  }

  return "Something went wrong. Please try again.";
}
