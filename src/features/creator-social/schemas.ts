import { z } from "zod";
import {
  instagramAccountTypes,
  normalizeHandle,
  platformCodes,
  validateAccountUrl,
  validateHandle,
} from "./catalogue";
import { metrics } from "./metrics";
const emptyToUndefined = (v: unknown) =>
  v === "" || v === null ? undefined : v;
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use ${max} characters or fewer.`)
    .optional()
    .transform((v) => v || undefined);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date.");
const today = () => new Date().toISOString().slice(0, 10);
const futureOk = (d: string) =>
  d <= new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

export const accountSchema = z
  .object({
    platform: z
      .string()
      .refine((v) => platformCodes.includes(v), "Choose a platform."),
    handle: z.string().transform(normalizeHandle),
    profile_url: z
      .string()
      .trim()
      .optional()
      .transform((v) => v || undefined),
    display_name: optText(80),
    account_type: z
      .string()
      .optional()
      .transform((v) => v || undefined),
    visibility: z.enum(["public", "private", "unknown"]).default("unknown"),
    ownership_scope: z
      .enum(["individual", "brand_or_company"])
      .default("individual"),
    content_category: optText(60),
    is_primary: z.boolean().default(false),
    preferred_for_platform: z.boolean().default(false),
    followers: z.preprocess(
      emptyToUndefined,
      z.coerce
        .number({ error: "Enter a whole number, or leave it blank." })
        .int("Enter a whole number.")
        .min(0, "Use zero or more.")
        .max(2_000_000_000, "That number is too large.")
        .optional(),
    ),
    observed_on: z.preprocess(emptyToUndefined, isoDate.optional()),
  })
  .superRefine((a, ctx) => {
    const h = validateHandle(a.platform, a.handle);
    if (!h.ok)
      ctx.addIssue({ code: "custom", path: ["handle"], message: h.reason });
    if (a.profile_url) {
      const u = validateAccountUrl(a.platform, a.profile_url);
      if (!u.ok)
        ctx.addIssue({
          code: "custom",
          path: ["profile_url"],
          message: u.reason,
        });
    }
    if (
      a.account_type &&
      (a.platform !== "instagram" ||
        !instagramAccountTypes.some(([c]) => c === a.account_type))
    )
      ctx.addIssue({
        code: "custom",
        path: ["account_type"],
        message: "Account type applies to Instagram only.",
      });
    if (a.observed_on && !futureOk(a.observed_on))
      ctx.addIssue({
        code: "custom",
        path: ["observed_on"],
        message: "The date cannot be in the future.",
      });
  });
export const updateSchema = z.object({
  display_name: optText(80),
  content_category: optText(60),
  profile_url: z.string().trim().optional(),
  handle: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : normalizeHandle(v))),
  visibility: z.enum(["public", "private", "unknown"]).optional(),
  account_type: z.string().optional(),
  ownership_scope: z.enum(["individual", "brand_or_company"]).optional(),
});
export const observationSchema = z.object({
  account: z.uuid(),
  metric: z
    .string()
    .refine(
      (v) => metrics.some((m) => m.code === v && m.scope === "account"),
      "Choose a metric.",
    ),
  value: z.coerce.number({ error: "Enter a number." }),
  observed_on: isoDate,
  period_start: z.preprocess(emptyToUndefined, isoDate.optional()),
  period_end: z.preprocess(emptyToUndefined, isoDate.optional()),
  note: optText(200),
});
export const contentObservationSchema = z
  .object({
    account: z.uuid(),
    url: z
      .string()
      .trim()
      .optional()
      .transform((v) => v || undefined),
    external_id: optText(200),
    title: optText(200),
    format: z.preprocess(
      emptyToUndefined,
      z
        .enum([
          "short_video",
          "long_video",
          "image",
          "carousel",
          "story",
          "text",
          "live",
          "other",
        ])
        .optional(),
    ),
    published_on: z.preprocess(emptyToUndefined, isoDate.optional()),
    metric: z
      .string()
      .refine(
        (v) => metrics.some((m) => m.code === v && m.scope === "content"),
        "Choose a metric.",
      ),
    value: z.coerce
      .number({ error: "Enter a number." })
      .min(0, "Use zero or more."),
    window: z.enum(["lifetime", "window"]),
    observed_on: isoDate,
    period_start: z.preprocess(emptyToUndefined, isoDate.optional()),
    period_end: z.preprocess(emptyToUndefined, isoDate.optional()),
    note: optText(200),
  })
  .superRefine((c, ctx) => {
    if (!c.url && !c.external_id)
      ctx.addIssue({
        code: "custom",
        path: ["url"],
        message: "Add a link or a content identifier.",
      });
    if (c.window === "window" && !(c.period_start && c.period_end))
      ctx.addIssue({
        code: "custom",
        path: ["period_start"],
        message: "Add the period this total covers.",
      });
    if (c.window === "lifetime" && (c.period_start || c.period_end))
      ctx.addIssue({
        code: "custom",
        path: ["period_start"],
        message: "A lifetime total has no period.",
      });
    if (c.observed_on > today() && !futureOk(c.observed_on))
      ctx.addIssue({
        code: "custom",
        path: ["observed_on"],
        message: "The date cannot be in the future.",
      });
  });
export const correctionSchema = z.object({
  observation: z.uuid(),
  value: z.coerce.number({ error: "Enter a number." }),
  reason: z
    .string()
    .trim()
    .min(3, "Say briefly why you are correcting this.")
    .max(200),
});
export const grantSchema = z.object({
  account: z.uuid(),
  recipient: z.uuid({ error: "Enter the recipient workspace id." }),
  fields: z
    .array(
      z.enum([
        "followers",
        "following",
        "posts_total",
        "reach",
        "impressions",
        "profile_views",
        "interactions",
        "audience_growth",
      ]),
    )
    .min(1, "Choose at least one field.")
    .max(8),
  purpose: z.string().trim().min(3, "Describe the purpose.").max(200),
  valid_days: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(1).max(365).optional(),
  ),
});
export const decisionSchema = z.object({
  claim: z.uuid(),
  decision: z.enum(["approved", "rejected", "needs_evidence", "revoked"]),
  reason: z.string().trim().min(3, "A reason is required.").max(500),
  replace: z.boolean().default(false),
});
export type FieldErrors = Record<string, string>;
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const i of error.issues) out[String(i.path[0] ?? "_")] ??= i.message;
  return out;
}
