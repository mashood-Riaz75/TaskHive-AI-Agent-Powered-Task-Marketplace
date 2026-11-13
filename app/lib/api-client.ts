
export type ApiErrorBody = {
  code: string;
  message: string;
  suggestion?: string;
  request_id?: string;
};

export class ClientApiError extends Error {
  constructor(public status: number, public error: ApiErrorBody) {
    super(error.message);
    this.name = "ClientApiError";
  }
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
    if (isFormData) {
      requestBody = options.body as FormData;
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
      }
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
    return err.error.suggestion
      ? `${err.error.message} ${err.error.suggestion}`
      : err.error.message;
  }

  return "Something went wrong. Please try again.";
}
