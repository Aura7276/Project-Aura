import { z } from "zod";
import { metrics } from "@/features/creator-social/metrics";
import { outcomes } from "./experiments";
export type FieldErrors = Record<string, string>;
export const fieldErrors = (e: z.ZodError): FieldErrors => {
  const o: FieldErrors = {};
  for (const i of e.issues) o[String(i.path[0] ?? "form")] ??= i.message;
  return o;
};
const text = (min: number, max: number, msg: string) =>
  z.string().trim().min(min, msg).max(max, `Use ${max} characters or fewer.`);
const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use ${max} characters or fewer.`)
    .optional()
    .transform((v) => v || undefined);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date.");
export const tagKinds = [
  "topic",
  "niche",
  "pillar",
  "hook",
  "duration",
  "style",
  "time_category",
  "sponsorship",
  "custom",
] as const;
export const tagSchema = z
  .object({
    content: z.uuid(),
    kind: z.enum(tagKinds),
    value: text(1, 60, "Enter a value.").regex(
      /^[^<>]+$/,
      "Remove < and > characters.",
    ),
  })
  .superRefine((v, c) => {
    if (
      v.kind === "sponsorship" &&
      !["organic", "sponsored"].includes(v.value.toLowerCase())
    )
      c.addIssue({
        code: "custom",
        path: ["value"],
        message: "Choose organic or sponsored.",
      });
  });
export const timingSchema = z.object({
  content: z.uuid(),
  date,
  time: z.string().regex(/^\d{2}:\d{2}$/, "Choose a time."),
  tz: text(3, 64, "Choose a time zone."),
});
export const audienceSchema = z
  .object({
    account: z.uuid(),
    dimension: z.enum(["geography", "language", "age_band", "activity"]),
    observed_on: date,
    denominator_kind: z
      .enum(["followers", "engaged_audience", "reached_audience", "unknown"])
      .default("unknown"),
    denominator: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.coerce.number().min(0).max(2_000_000_000).optional(),
    ),
    coverage: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.coerce.number().min(0).max(100).optional(),
    ),
    note: opt(200),
    buckets: z
      .array(
        z.object({
          bucket: text(1, 60, "Name each group.").regex(
            /^[A-Za-z0-9 ,.+&'/()-]+$/,
            "Use letters, numbers and simple punctuation.",
          ),
          share: z.coerce
            .number({ error: "Enter a percentage." })
            .min(0, "Use 0 to 100.")
            .max(100, "Use 0 to 100."),
        }),
      )
      .min(1, "Add at least one group.")
      .max(30),
  })
  .superRefine((v, c) => {
    const names = v.buckets.map((b) => b.bucket.toLowerCase());
    if (new Set(names).size !== names.length)
      c.addIssue({
        code: "custom",
        path: ["buckets"],
        message: "Each group needs a different name.",
      });
    if (v.buckets.reduce((n, b) => n + b.share, 0) > 100.5)
      c.addIssue({
        code: "custom",
        path: ["buckets"],
        message: "The percentages add up to more than 100.",
      });
  });
export const grantSchema = z.object({
  account: z.uuid(),
  recipient: z.uuid({ error: "Enter the recipient workspace id." }),
  dimensions: z
    .array(z.enum(["geography", "language", "age_band", "activity"]))
    .min(1, "Choose at least one.")
    .max(4),
  purpose: text(3, 200, "Describe the purpose."),
  days: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.coerce.number().int().min(1).max(365).optional(),
  ),
});
export const experimentSchema = z.object({
  account: z.uuid(),
  name: text(3, 100, "Name the experiment."),
  hypothesis: text(5, 500, "State your hypothesis."),
  objective: opt(300),
  metric: z
    .string()
    .refine((m) => metrics.some((x) => x.code === m), "Choose a metric."),
  planned_change: opt(500),
  measurement_method: opt(500),
  success_criterion: opt(300),
  confounders: opt(500),
  evaluation_days: z.coerce
    .number()
    .int()
    .min(3, "At least 3 days.")
    .max(180, "At most 180 days."),
  baseline_refs: z.array(z.uuid()).max(20).default([]),
  baseline_unavailable_reason: opt(300),
  template_key: opt(60),
  source_insight: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.uuid().optional(),
  ),
});
export const finishSchema = z.object({
  id: z.uuid(),
  outcome: z.enum(outcomes, { error: "Choose an outcome." }),
  interpretation: opt(1000),
  next: opt(500),
  tags: z
    .string()
    .default("")
    .transform((s) =>
      s
        .split(",")
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 8),
    ),
});
export const exportSchema = z.object({
  kind: z.enum([
    "summary",
    "observations",
    "content",
    "audience",
    "experiments",
  ]),
  format: z.enum(["csv", "pdf"]),
  purpose: text(3, 200, "Say what the export is for."),
});
