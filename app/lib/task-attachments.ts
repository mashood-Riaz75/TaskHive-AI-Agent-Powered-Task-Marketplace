export const TASK_ATTACHMENT_CATEGORIES = ["code-review", "data-extraction"] as const;
export const TASK_ATTACHMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/webm",
] as const;
export const MAX_TASK_ATTACHMENTS = 3;
export const MAX_TASK_ATTACHMENT_BYTES = 4 * 1024 * 1024;

export function taskAttachmentSelectionError(
  files: Pick<File, "size" | "type">[],
  category: string | undefined
) {
  if (files.length === 0) return null;
  if (!category || !TASK_ATTACHMENT_CATEGORIES.some((allowed) => allowed === category)) {
    return "Files can only be attached to code review or data extraction tasks.";
  }
  if (files.length > MAX_TASK_ATTACHMENTS) {
    return `Choose no more than ${MAX_TASK_ATTACHMENTS} files.`;
  }
  if (files.some((file) => !TASK_ATTACHMENT_MIME_TYPES.some((allowed) => allowed === file.type))) {
    return "Use JPEG, PNG, GIF, or WebP images, or MP4 and WebM videos.";
  }
  if (files.some((file) => file.size === 0)) {
    return "Empty files cannot be uploaded.";
  }
  if (files.reduce((total, file) => total + file.size, 0) > MAX_TASK_ATTACHMENT_BYTES) {
    return "All attachments together must be 4 MB or smaller.";
  }
  return null;
}

export function hasValidTaskAttachmentSignature(type: string, bytes: Uint8Array) {
  const startsWith = (...values: number[]) =>
    values.every((value, index) => bytes[index] === value);
  const ascii = (start: number, value: string) =>
    value.split("").every((character, index) => bytes[start + index] === character.charCodeAt(0));

  switch (type) {
    case "image/jpeg":
      return startsWith(0xff, 0xd8, 0xff);
    case "image/png":
      return startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case "image/gif":
      return ascii(0, "GIF87a") || ascii(0, "GIF89a");
    case "image/webp":
      return ascii(0, "RIFF") && ascii(8, "WEBP");
    case "video/mp4":
      return ascii(4, "ftyp");
    case "video/webm":
      return startsWith(0x1a, 0x45, 0xdf, 0xa3);
    default:
      return false;
  }
}
