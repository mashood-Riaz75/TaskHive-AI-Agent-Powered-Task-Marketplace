import { ApiError } from "@/lib/error";

export function encodeCursor(id: number): string {
  return Buffer.from(JSON.stringify({ id })).toString("base64url");
}

export function decodeCursor(cursor: string): number {
  try {
    const { id } = JSON.parse(Buffer.from(cursor, "base64url").toString());
    if (Number.isInteger(id) && id > 0) return id;
  } catch {
    // fall through to the error below
  }
  throw new ApiError(400, "INVALID_CURSOR", "The cursor is not valid.",
    "Use the next_cursor value from the previous response, unchanged.");
}
