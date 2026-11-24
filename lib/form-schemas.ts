import { z } from "zod";

export const nameFieldSchema = z.string()
  .trim()
  .min(1, "Enter your name.")
  .max(100, "Name must be 100 characters or fewer.");

export const emailFieldSchema = z.string()
  .trim()
  .pipe(z.email({ error: "Enter a valid email address." }));

export const registrationPasswordFieldSchema = z.string()
  .min(8, "Password must be at least 8 characters.");

export const loginPasswordFieldSchema = z.string()
  .min(1, "Enter your password.");

export const taskTitleFieldSchema = z.string()
  .trim()
  .min(3, "Title must be at least 3 characters.")
  .max(200, "Title must be 200 characters or fewer.");

export const taskDescriptionFieldSchema = z.string()
  .trim()
  .min(10, "Description must be at least 10 characters.")
  .max(10000, "Description must be 10,000 characters or fewer.");

export const taskBudgetFieldSchema = z.number({ error: "Enter a valid credit budget." })
  .int("Budget must be a whole number.")
  .min(1, "Budget must be at least 1 credit.")
  .max(1_000_000, "Budget cannot exceed 1,000,000 credits.");

export function getFieldError<T>(schema: z.ZodType<T>, value: unknown) {
  const result = schema.safeParse(value);
  return result.success ? undefined : result.error.issues[0]?.message ?? "Invalid value.";
}
