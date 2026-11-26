import { z } from "zod";
import { checkUsername } from "./rules";
export type FieldErrors = Record<string, string>;
export const fieldErrors = (e: z.ZodError): FieldErrors => {
  const o: FieldErrors = {};
  for (const i of e.issues) o[String(i.path[0] ?? "form")] ??= i.message;
  return o;
};
const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use ${max} characters or fewer.`)
    .optional()
    .transform((v) => v || "");
const req = (min: number, max: number, msg: string) =>
  z.string().trim().min(min, msg).max(max, `Use ${max} characters or fewer.`);
const https = z
  .string()
  .trim()
  .max(400)
  .optional()
  .transform((v) => v || "")
  .refine(
    (v) => !v || /^https:\/\/[^/\s@]+(\/[^\s]*)?$/.test(v),
    "Use a full https:// link.",
  );
const num = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.coerce.number({ error: "Enter a number." }).min(min).max(max).optional(),
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
const lines = z
  .string()
  .optional()
  .transform((v) =>
    (v ?? "")
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean),
  )
  .refine((a) => a.length <= 12, "Use 12 lines or fewer.")
  .refine(
    (a) => a.every((x) => x.length <= 120),
    "Keep each line under 120 characters.",
  );
export const profileSchema = z.object({
  username: z
    .string()
    .optional()
    .transform((v) => v ?? "")
    .superRefine((v, c) => {
      if (!v) return;
      const r = checkUsername(v);
      if (!r.ok) c.addIssue({ code: "custom", message: r.reason });
    })
    .transform((v) => v.trim().toLowerCase().replace(/^@+/, "")),
  headline: opt(120),
  about: opt(2000),
});
export const appearanceSchema = z.object({
  theme: z.enum(["ivory", "midnight", "sage", "peach"]),
  cover: z.enum(["aurora", "grid", "waves", "plain"]),
  show_branding: z.boolean(),
  section_order: z
    .array(
      z.enum([
        "about",
        "portfolio",
        "case_studies",
        "services",
        "experience",
        "testimonials",
        "accounts",
        "availability",
      ]),
    )
    .length(8),
});
export const availabilitySchema = z
  .object({
    availability: z.enum(["open", "limited", "unavailable"]),
    available_from: z
      .string()
      .optional()
      .transform((v) => v ?? ""),
    available_until: z
      .string()
      .optional()
      .transform((v) => v ?? ""),
    availability_note: opt(200),
  })
  .refine(
    (v) =>
      !v.available_from ||
      !v.available_until ||
      v.available_until >= v.available_from,
    {
      path: ["available_until"],
      message: "The end date is before the start date.",
    },
  );
export const itemSchema = z
  .object({
    kind: z.enum([
      "organic",
      "commercial",
      "ugc_sample",
      "speculative",
      "case_study",
    ]),
    title: req(2, 120, "Give it a title."),
    description: opt(2000),
    link: https,
    content_ref: z
      .string()
      .optional()
      .transform((v) => v || ""),
    brand_name: opt(100),
    year: int(2000, 2100),
    objective: opt(600),
    approach: opt(1200),
    contribution: opt(600),
    deliverables: lines,
    outcomes: lines,
    show_metrics: z.boolean(),
    visibility: z.enum(["private", "public", "restricted"]),
    featured: z.boolean(),
  })
  .superRefine((v, c) => {
    if (v.kind === "commercial" && !v.brand_name)
      c.addIssue({
        code: "custom",
        path: ["brand_name"],
        message:
          "Commercial work names the brand. Use speculative if it was not commissioned.",
      });
  });
export const serviceSchema = z
  .object({
    kind: z.enum(["influencer", "ugc", "other"]),
    name: req(2, 80, "Name the service."),
    description: opt(800),
    deliverables: lines,
    pricing: z.enum(["quote", "fixed", "range"]),
    currency: z.string().regex(/^[A-Z]{3}$/),
    price_min: num(0, 100_000_000),
    price_max: num(0, 100_000_000),
    visibility: z.enum(["private", "public", "restricted"]),
    rates_visibility: z.enum(["private", "restricted"]),
  })
  .superRefine((v, c) => {
    if (v.pricing !== "quote" && v.price_min === undefined)
      c.addIssue({
        code: "custom",
        path: ["price_min"],
        message: "Enter a price, or choose quote on request.",
      });
    if (
      v.pricing === "range" &&
      (v.price_max === undefined ||
        (v.price_min !== undefined && v.price_max < v.price_min))
    )
      c.addIssue({
        code: "custom",
        path: ["price_max"],
        message: "The upper price must be at least the lower one.",
      });
  });
export const packageSchema = z
  .object({
    service_kind: z.enum(["influencer", "ugc", "other"]),
    name: req(2, 80, "Name the package."),
    description: opt(800),
    deliverables: lines,
    currency: z.string().regex(/^[A-Z]{3}$/),
    price_min: num(0, 100_000_000),
    price_max: num(0, 100_000_000),
    turnaround_days: int(1, 365),
    revisions: int(0, 20),
    usage_rights: opt(400),
    terms: opt(1200),
    visibility: z.enum(["private", "restricted"]),
  })
  .superRefine((v, c) => {
    if (
      v.price_max !== undefined &&
      (v.price_min === undefined || v.price_max < v.price_min)
    )
      c.addIssue({
        code: "custom",
        path: ["price_max"],
        message: "The upper price must be at least the lower one.",
      });
  });
export const experienceSchema = z
  .object({
    organisation: req(2, 100, "Name the organisation."),
    role: opt(100),
    year_from: int(1990, 2100),
    year_to: int(1990, 2100),
    description: opt(800),
    evidence_url: https,
    visibility: z.enum(["private", "public", "restricted"]),
  })
  .refine(
    (v) =>
      v.year_to === undefined ||
      v.year_from === undefined ||
      v.year_to >= v.year_from,
    { path: ["year_to"], message: "The end year is before the start year." },
  );
export const kitSchema = z.object({
  name: req(2, 80, "Name the kit."),
  audience: opt(120),
  template: z.enum(["editorial", "classic", "compact"]),
  intro: opt(800),
  contact_note: opt(300),
});
export const shareSchema = z
  .object({
    kind: z.enum(["public", "restricted"]),
    recipient: z
      .string()
      .optional()
      .transform((v) => v ?? ""),
    version: z
      .string()
      .optional()
      .transform((v) => v ?? ""),
    include_rates: z.boolean(),
    label: opt(100),
    days: int(1, 365),
  })
  .superRefine((v, c) => {
    if (v.kind === "restricted" && !/^[0-9a-f-]{36}$/i.test(v.recipient))
      c.addIssue({
        code: "custom",
        path: ["recipient"],
        message: "Enter the Brand or Agency workspace id.",
      });
  });
export const testimonialSchema = z.object({
  author_name: req(2, 80, "Your name as it should appear."),
  author_role: opt(100),
  relationship: z.enum(["brand_client", "agency", "collaborator", "other"]),
  body: req(20, 1200, "Write at least 20 characters."),
});
