import { z } from "zod";
export type FieldErrors = Record<string, string>;
export const fieldErrors = (e: z.ZodError): FieldErrors => {
  const o: FieldErrors = {};
  for (const i of e.issues) o[String(i.path[0] ?? "form")] ??= i.message;
  return o;
};
const num = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.coerce
      .number({ error: "Enter a number." })
      .min(min, `Use ${min} or more.`)
      .max(max, `Use ${max} or less.`)
      .optional(),
  );
const int = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.coerce
      .number({ error: "Enter a whole number." })
      .int()
      .min(min, `Use ${min} or more.`)
      .max(max, `Use ${max} or less.`)
      .optional(),
  );
const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use ${max} characters or fewer.`)
    .optional()
    .transform((v) => v || undefined);
const list = z
  .string()
  .optional()
  .transform((v) =>
    (v ?? "")
      .split(/[,\n]/)
      .map((x) => x.trim())
      .filter(Boolean),
  );
/** The Brand campaign form. It builds the content object the database validates again (the database is authoritative). */
export const campaignForm = z
  .object({
    category: z.enum([
      "paid",
      "ugc",
      "barter",
      "affiliate",
      "ambassador",
      "event",
    ]),
    visibility: z.enum(["public", "restricted", "invite_only"]),
    show_applicant_count: z.boolean(),
    title: z.string().trim().min(5, "Use at least 5 characters.").max(120),
    // Drafts may be incomplete (M17 builder saves one step at a time); the database checks completeness before publication.
    summary: z
      .string()
      .trim()
      .max(300)
      .refine((v) => v === "" || v.length >= 20, "Use at least 20 characters."),
    brief: z
      .string()
      .trim()
      .max(6000)
      .refine(
        (v) => v === "" || v.length >= 50,
        "Describe the work in at least 50 characters.",
      ),
    deliverables: z.string().trim(),
    closes_on: z
      .string()
      .refine(
        (v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v),
        "Choose a closing date.",
      ),
    starts_on: z
      .string()
      .optional()
      .transform((v) => v || undefined),
    money_type: z.enum(["none", "fixed", "range"]),
    currency: z.string().regex(/^[A-Z]{3}$/),
    money_min: num(1, 100_000_000),
    money_max: num(1, 100_000_000),
    money_negotiable: z.boolean(),
    products: opt(300),
    product_value: num(0, 100_000_000),
    services: opt(300),
    experiences: opt(300),
    commission_pct: num(0, 100),
    commission_terms: opt(200),
    usage_months: int(0, 120),
    channels: list,
    whitelisting: z.boolean(),
    exclusivity_days: int(0, 365),
    exclusivity_scope: opt(120),
    rights_negotiable: z.boolean(),
    travel_required: z.boolean(),
    travel_covered: z.boolean(),
    positions: int(1, 10000),
    min_followers: int(1, 100_000_000),
    platforms: list,
    verified_ownership: z.boolean(),
    countries: list,
    languages: list,
    niches: list,
    beginner_friendly: z.boolean(),
    remote: z.boolean(),
    effort_note: opt(300),
  })
  .superRefine((v, c) => {
    if (v.money_type !== "none" && v.money_min === undefined)
      c.addIssue({
        code: "custom",
        path: ["money_min"],
        message: "Enter the amount.",
      });
    if (
      v.money_type === "range" &&
      (v.money_max === undefined ||
        (v.money_min !== undefined && v.money_max < v.money_min))
    )
      c.addIssue({
        code: "custom",
        path: ["money_max"],
        message: "The upper amount must be at least the lower one.",
      });
    if (v.category === "ugc" && v.min_followers !== undefined)
      c.addIssue({
        code: "custom",
        path: ["min_followers"],
        message: "UGC campaigns cannot require a follower count.",
      });
  });
export type CampaignForm = z.infer<typeof campaignForm>;
export function toContent(v: CampaignForm) {
  const deliverables = v.deliverables
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((l) => {
      const m = /^(\d{1,3})\s*(?:x|×)?\s+(.+?)(?:\s+on\s+([A-Za-z ]+))?$/i.exec(
        l,
      );
      return m
        ? {
            type: m[2].slice(0, 80),
            quantity: Number(m[1]),
            platform: m[3]?.trim().toLowerCase(),
          }
        : { type: l.slice(0, 80), quantity: 1 };
    });
  return {
    title: v.title,
    summary: v.summary,
    brief: v.brief,
    deliverables,
    ...(v.closes_on ? { closes_at: `${v.closes_on}T23:59:00+05:30` } : {}),
    starts_on: v.starts_on,
    positions: v.positions ?? null,
    remote: v.remote,
    effort_note: v.effort_note,
    countries: v.countries
      .map((x) => x.toUpperCase())
      .filter((x) => /^[A-Z]{2}$/.test(x)),
    languages: v.languages
      .map((x) => x.toLowerCase())
      .filter((x) => /^[a-z]{2,3}$/.test(x)),
    compensation: {
      money:
        v.money_type === "none"
          ? { type: "none" }
          : {
              type: v.money_type,
              currency: v.currency,
              min: v.money_min,
              max: v.money_type === "range" ? v.money_max : undefined,
              negotiable: v.money_negotiable,
            },
      products: v.products
        ? { description: v.products, value: v.product_value ?? null }
        : undefined,
      services: v.services ? { description: v.services } : undefined,
      experiences: v.experiences ? { description: v.experiences } : undefined,
      commission: v.commission_pct
        ? { rate_pct: v.commission_pct, terms: v.commission_terms }
        : undefined,
    },
    rights: {
      usage_months: v.usage_months ?? null,
      channels: v.channels,
      whitelisting: v.whitelisting,
      exclusivity_days: v.exclusivity_days ?? 0,
      exclusivity_scope: v.exclusivity_scope,
      negotiable: v.rights_negotiable,
    },
    travel: { required: v.travel_required, covered: v.travel_covered },
    requirements: {
      min_followers: v.min_followers ?? null,
      platforms: v.platforms.map((p) => p.toLowerCase()),
      verified_ownership: v.verified_ownership,
    },
    preferred: {
      niches: v.niches.map((n) => n.toLowerCase().replace(/\s+/g, "_")),
      beginner_friendly: v.beginner_friendly,
    },
  };
}
