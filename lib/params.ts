import { ApiError } from "@/lib/error";

export function parseId(raw: string, label: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new ApiError(400, "INVALID_ID", `'${raw}' is not a valid ${label} id.`,
      "Ids are positive integers, for example 1.");
  }
  return n;
}