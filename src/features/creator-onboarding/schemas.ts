import { z } from "zod";
import {
  accountTypes,
  challengeCodes,
  collaborationCategories,
  currencies,
  goalCategories,
  industryCodes,
  nicheCodes,
  platforms,
  rateFormats,
  equipment as equipmentList,
  stages,
  countries,
  languages,
} from "./taxonomy";
import {
  handlePattern,
  normalizeHandle,
  validateProfileUrl,
} from "./social-url";
import { toMinor } from "./money";
import type { StepId } from "./types";

const optionalText = (
  max: number,
  message = `Use ${max} characters or fewer.`,
) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .transform((v) => (v ? v : null));
const oneOf = <T extends readonly (readonly [string, ...unknown[]])[]>(
  list: T,
  message: string,
) => z.string().refine((v) => list.some(([c]) => c === v), message);
const emptyToUndefined = (v: unknown) =>
  v === "" || v === null ? undefined : v;
const wholeNumber = (min: number, max: number, message: string) =>
  z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ error: message })
      .int(message)
      .min(min, message)
      .max(max, message)
      .optional(),
  );

export const identitySchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(1, "Enter the name you want to use.")
    .max(80, "Use 80 characters or fewer."),
  country: oneOf(countries, "Choose your country."),
  city: optionalText(80),
  language: oneOf(languages, "Choose a preferred language."),
  bio: optionalText(280),
  stage: oneOf(stages, "Choose the option that fits you best."),
});

const today = () => new Date().toISOString().slice(0, 10);
export const accountSchema = z
  .object({
    platform: oneOf(platforms, "Choose a platform."),
    handle: z
      .string()
      .transform(normalizeHandle)
      .pipe(
        z
          .string()
          .regex(
            handlePattern,
            "Use letters, numbers, dots, dashes or underscores.",
          ),
      ),
    profile_url: z.string().optional(),
    account_type: z.string().optional(),
    ownership_scope: z
      .enum(["individual", "brand_or_company"])
      .default("individual"),
    visibility: z.enum(["public", "private", "unknown"]).default("unknown"),
    self_reported_followers: wholeNumber(
      0,
      2_000_000_000,
      "Enter a whole number, or leave it blank.",
    ),
    observed_on: z.string().optional(),
    is_primary: z.boolean().default(false),
  })
  .superRefine((a, ctx) => {
    if (a.account_type && a.platform !== "instagram")
      ctx.addIssue({
        code: "custom",
        path: ["account_type"],
        message: "Account type applies to Instagram only.",
      });
    if (a.account_type && !accountTypes.some(([c]) => c === a.account_type))
      ctx.addIssue({
        code: "custom",
        path: ["account_type"],
        message: "Choose Personal, Creator or Business.",
      });
    if (a.profile_url) {
      const r = validateProfileUrl(a.platform, a.profile_url);
      if (!r.ok)
        ctx.addIssue({
          code: "custom",
          path: ["profile_url"],
          message: r.reason,
        });
    }
    if (
      a.observed_on &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(a.observed_on) || a.observed_on > today())
    )
      ctx.addIssue({
        code: "custom",
        path: ["observed_on"],
        message: "Use a date that is not in the future.",
      });
  })
  .transform((a) => ({
    platform: a.platform,
    handle: a.handle,
    profile_url: a.profile_url
      ? (validateProfileUrl(a.platform, a.profile_url) as { url: string }).url
      : null,
    account_type: a.account_type || null,
    ownership_scope: a.ownership_scope,
    visibility: a.visibility,
    self_reported_followers: a.self_reported_followers ?? null,
    observed_on:
      a.self_reported_followers === undefined ? null : a.observed_on || today(),
    is_primary: a.is_primary,
  }));
export const socialSchema = z
  .object({
    none: z.boolean().default(false),
    accounts: z
      .array(accountSchema)
      .max(10, "You can add up to 10 accounts.")
      .default([]),
  })
  .superRefine((v, ctx) => {
    const seen = new Set<string>();
    v.accounts.forEach((a, i) => {
      const key = `${a.platform}:${a.handle.toLowerCase()}`;
      if (seen.has(key))
        ctx.addIssue({
          code: "custom",
          path: ["accounts", i, "handle"],
          message: "You already added this account.",
        });
      seen.add(key);
    });
    if (v.accounts.filter((a) => a.is_primary).length > 1)
      ctx.addIssue({
        code: "custom",
        path: ["accounts"],
        message: "Choose only one primary account.",
      });
  })
  .transform((v) => {
    if (v.none) return { none: true, accounts: [] };
    const accounts =
      v.accounts.some((a) => a.is_primary) || !v.accounts.length
        ? v.accounts
        : v.accounts.map((a, i) => ({ ...a, is_primary: i === 0 }));
    return { none: false, accounts };
  });

const nicheItem = z
  .object({
    code: oneOf([...nicheCodes.map((c) => [c] as const)], "Choose a niche."),
    custom_label: z.string().trim().max(60).optional(),
  })
  .superRefine((n, ctx) => {
    if ((n.code === "custom" || n.code === "other") && !n.custom_label)
      ctx.addIssue({
        code: "custom",
        path: ["custom_label"],
        message: "Describe your niche in a few words.",
      });
  })
  .transform((n) => ({
    code: n.code,
    custom_label:
      n.code === "custom" || n.code === "other"
        ? (n.custom_label as string)
        : null,
  }));
export const nicheSchema = z
  .object({
    exploring: z.boolean().default(false),
    primary: nicheItem.nullable().optional(),
    secondary: z
      .array(nicheItem)
      .max(5, "Choose up to 5 secondary niches.")
      .default([]),
    interests: z
      .array(nicheItem)
      .max(8, "Choose up to 8 interests.")
      .default([]),
  })
  .superRefine((v, ctx) => {
    if (!v.exploring && !v.primary)
      ctx.addIssue({
        code: "custom",
        path: ["primary"],
        message: "Choose a primary niche, or say you are still exploring.",
      });
  })
  .transform((v) => ({
    exploring: v.exploring,
    primary: v.primary ?? null,
    secondary: v.secondary,
    interests: v.interests,
  }));

const goalSchema = z
  .object({
    category: oneOf(goalCategories, "Choose a goal."),
    metric: z.string().optional(),
    baseline: z.preprocess(
      emptyToUndefined,
      z.coerce
        .number({ error: "Enter a number, or leave it blank." })
        .min(0, "Use zero or more.")
        .max(1e12)
        .optional(),
    ),
    target: z.preprocess(
      emptyToUndefined,
      z.coerce
        .number({ error: "Enter a number, or leave it blank." })
        .min(0, "Use zero or more.")
        .max(1e12)
        .optional(),
    ),
    currency: z.string().optional(),
    timeframe_days: wholeNumber(7, 730, "Use between 7 and 730 days."),
    details: optionalText(300),
  })
  .superRefine((g, ctx) => {
    const def = goalCategories.find(([c]) => c === g.category)?.[2] ?? null;
    if (
      g.metric &&
      ![
        "follower_count",
        "engagement_rate",
        "posts_per_week",
        "posts_per_month",
        "monthly_income",
      ].includes(g.metric)
    )
      ctx.addIssue({
        code: "custom",
        path: ["metric"],
        message: "Choose a measure.",
      });
    if (
      (g.target !== undefined || g.baseline !== undefined) &&
      !(g.metric || def)
    )
      ctx.addIssue({
        code: "custom",
        path: ["metric"],
        message: "Choose what you are measuring.",
      });
    if (
      (g.metric ?? def) === "monthly_income" &&
      g.target !== undefined &&
      !currencies.includes(g.currency as never)
    )
      ctx.addIssue({
        code: "custom",
        path: ["currency"],
        message: "Choose a currency.",
      });
  })
  .transform((g) => {
    const def = goalCategories.find(([c]) => c === g.category)?.[2] ?? null;
    const metric =
      g.target !== undefined || g.baseline !== undefined
        ? g.metric || def
        : null;
    return {
      category: g.category,
      metric: metric ?? null,
      baseline_kind:
        g.baseline === undefined
          ? ("unknown" as const)
          : ("self_reported" as const),
      baseline_value: g.baseline ?? null,
      target_value: g.target ?? null,
      currency: metric === "monthly_income" ? (g.currency ?? "INR") : null,
      timeframe_days: g.timeframe_days ?? null,
      details: g.details,
    };
  });
export const goalsSchema = z
  .object({
    goals: z.array(goalSchema).min(1, "Choose at least one goal.").max(10),
  })
  .superRefine((v, ctx) => {
    const seen = new Set<string>();
    v.goals.forEach((g, i) => {
      const key = g.category + ":" + (g.metric ?? "");
      if (seen.has(key))
        ctx.addIssue({
          code: "custom",
          path: ["goals", i, "category"],
          message: "You already added this goal.",
        });
      seen.add(key);
    });
  });

export const challengesSchema = z.object({
  challenges: z
    .array(
      z.object({
        code: oneOf(
          [...challengeCodes.map((c) => [c] as const)],
          "Choose a challenge.",
        ),
        detail: optionalText(300),
      }),
    )
    .max(16)
    .default([]),
});

const industryList = z
  .array(
    oneOf([...industryCodes.map((c) => [c] as const)], "Choose an industry."),
  )
  .max(20)
  .default([]);
export const preferencesSchema = z
  .object({
    collaborations: z
      .array(oneOf(collaborationCategories, "Choose a collaboration type."))
      .max(6)
      .default([]),
    prior_collaboration: z
      .enum(["", "none", "some", "regular"])
      .optional()
      .transform((v) => v || null),
    preferred: industryList,
    considering: industryList,
    exclusions: z
      .array(
        z.object({
          industry: oneOf(
            [...industryCodes.map((c) => [c] as const)],
            "Choose an industry.",
          ),
          note: optionalText(200),
        }),
      )
      .max(20)
      .default([]),
    restrictions: optionalText(300),
  })
  .transform((v) => {
    const excluded = new Set(v.exclusions.map((e) => e.industry)); // explicit exclusions take precedence
    const industries = [
      ...v.preferred
        .filter((i) => !excluded.has(i))
        .map((industry) => ({ industry, stance: "preferred" as const })),
      ...v.considering
        .filter((i) => !excluded.has(i) && !v.preferred.includes(i))
        .map((industry) => ({ industry, stance: "considering" as const })),
    ];
    return {
      collaborations: collaborationCategories.map(([category]) => ({
        category,
        interested: v.collaborations.includes(category),
      })),
      prior_collaboration: v.prior_collaboration,
      industries,
      exclusions: v.exclusions,
      restrictions: v.restrictions,
    };
  });

export const ratesSchema = z.object({
  rates: z
    .array(
      z
        .object({
          format: oneOf(rateFormats, "Choose a format."),
          amount: z.string().optional(),
          currency: z.enum(currencies).default("INR"),
          negotiable: z.boolean().default(true),
          unsure: z.boolean().default(false),
        })
        .superRefine((r, ctx) => {
          if (!r.unsure && r.amount && toMinor(r.amount) === null)
            ctx.addIssue({
              code: "custom",
              path: ["amount"],
              message: "Enter an amount such as 2500 or 2500.50.",
            });
        })
        .transform((r) => ({
          format: r.format,
          amount_minor: r.unsure || !r.amount ? null : toMinor(r.amount),
          currency: r.currency,
          negotiable: r.negotiable,
          unsure: r.unsure,
        })),
    )
    .max(8)
    .default([]),
});

export const resourcesSchema = z
  .object({
    hours_per_week: z.preprocess(
      emptyToUndefined,
      z.coerce
        .number({ error: "Enter a number of hours." })
        .min(0, "Use zero or more.")
        .max(168, "A week has 168 hours.")
        .optional(),
    ),
    posts_per_week: wholeNumber(0, 50, "Use a whole number from 0 to 50."),
    equipment: z
      .array(oneOf(equipmentList, "Choose from the list."))
      .default([]),
    budget: z.string().optional(),
    budget_currency: z.enum(currencies).default("INR"),
  })
  .superRefine((r, ctx) => {
    if (r.budget && toMinor(r.budget) === null)
      ctx.addIssue({
        code: "custom",
        path: ["budget"],
        message: "Enter an amount such as 2000.",
      });
  })
  .transform((r) => {
    const minor = r.budget ? toMinor(r.budget) : null;
    return {
      hours_per_week: r.hours_per_week ?? null,
      posts_per_week: r.posts_per_week ?? null,
      equipment: r.equipment,
      budget_minor: minor,
      budget_currency: minor === null ? null : r.budget_currency,
    };
  });

export const sectionSchemas = {
  identity: identitySchema,
  social: socialSchema,
  niche: nicheSchema,
  goals: goalsSchema,
  challenges: challengesSchema,
  preferences: preferencesSchema,
  rates: ratesSchema,
  resources: resourcesSchema,
} as const satisfies Record<StepId, z.ZodType>;

export type FieldErrors = Record<string, string>;
export function parseSection(
  section: StepId,
  raw: unknown,
):
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; errors: FieldErrors } {
  const result = sectionSchemas[section].safeParse(raw);
  if (result.success)
    return { ok: true, data: result.data as Record<string, unknown> };
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "_";
    errors[key] ??= issue.message;
  }
  return { ok: false, errors };
}
