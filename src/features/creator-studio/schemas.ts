import { z } from "zod";
import { widgetIds } from "./types";
export const timezones = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Dhaka",
  "Asia/Karachi",
  "Asia/Colombo",
  "Asia/Kathmandu",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Australia/Sydney",
  "UTC",
] as const;
export const prefsSchema = z.object({
  hidden: z.array(z.enum(widgetIds)).default([]),
  gamification: z.boolean().default(true),
  digest: z.boolean().default(false),
  timezone: z.enum(timezones),
});
export const defaultPrefs = {
  hidden: [],
  gamification: true,
  digest: false,
  timezone: "Asia/Kolkata",
} as const;
export const ideaSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Give your idea a title.")
    .max(120, "Use 120 characters or fewer."),
  note: z
    .string()
    .trim()
    .max(1000, "Use 1,000 characters or fewer.")
    .optional()
    .transform((v) => v || null),
});
export const observationSchema = z.object({
  goal: z.string().regex(/^[a-z_]+:[a-z_]+$/, "Choose a goal."),
  value: z.coerce
    .number({ error: "Enter a number." })
    .min(0, "Use zero or more.")
    .max(1e12, "That number is too large."),
  observed_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date."),
  note: z
    .string()
    .trim()
    .max(200, "Use 200 characters or fewer.")
    .optional()
    .transform((v) => v || null),
});
export const actionStatusSchema = z.enum([
  "pending",
  "completed",
  "skipped",
  "deferred",
]);
export const walkthroughSchema = z.enum(["not_seen", "completed", "dismissed"]);
export type FieldErrors = Record<string, string>;
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const i of error.issues) out[String(i.path[0] ?? "_")] ??= i.message;
  return out;
}
