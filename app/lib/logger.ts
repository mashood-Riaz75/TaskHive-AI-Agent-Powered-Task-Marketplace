type Level = "debug" | "info" | "warn" | "error";

const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const runtimeProcess = globalThis as typeof globalThis & {
  process?: {
    env?: Record<string, string | undefined>;
  };
};
const minLevel: Level =
  (runtimeProcess.process?.env?.LOG_LEVEL as Level | undefined) ??
  (runtimeProcess.process?.env?.NODE_ENV === "production" ? "info" : "debug");

// Never let secrets reach the logs
const SECRET_KEYS = ["password", "authorization", "api_key", "apikey", "token", "cookie", "secret"];

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) =>
        SECRET_KEYS.some((s) => k.toLowerCase().includes(s))
          ? [k, "[REDACTED]"]
          : [k, redact(v)]
      )
    );
  }
  return value;
}

function write(level: Level, message: string, context: Record<string, unknown> = {}) {
  if (order[level] < order[minLevel]) return;
  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    message,
    ...(redact(context) as object),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (m: string, c?: Record<string, unknown>) => write("debug", m, c),
  info: (m: string, c?: Record<string, unknown>) => write("info", m, c),
  warn: (m: string, c?: Record<string, unknown>) => write("warn", m, c),
  error: (m: string, c?: Record<string, unknown>) => write("error", m, c),
};