import { z } from "zod";
export type FieldErrors = Record<string, string>;
export const fieldErrors = (e: z.ZodError): FieldErrors => { const o: FieldErrors = {}; for (const i of e.issues) o[String(i.path[0] ?? "form")] ??= i.message; return o; };
const num = (min: number, max: number) => z.preprocess((v) => (v === "" || v === undefined ? undefined : v), z.coerce.number({ error: "Enter a number." }).min(min).max(max).optional());
export const termsForm = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/), amount: num(0, 100_000_000), deliverables: z.string().optional().transform((v) => v ?? ""),
  start_on: z.string().optional().transform((v) => v || undefined), end_on: z.string().optional().transform((v) => v || undefined), revisions: num(0, 20),
  usage_months: num(0, 120), channels: z.string().optional().transform((v) => (v ?? "").split(",").map((x) => x.trim()).filter(Boolean)), exclusivity_days: num(0, 365),
  note: z.string().trim().max(1000).optional(), valid_days: num(1, 30),
}).refine((v) => !v.start_on || !v.end_on || v.end_on >= v.start_on, { path: ["end_on"], message: "The end date is before the start date." });
export function toTerms(v: z.infer<typeof termsForm>) {
  const deliverables = v.deliverables.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 20).map((l) => { const m = /^(\d{1,3})\s*(?:x|×)?\s+(.+)$/i.exec(l); return m ? { type: m[2].slice(0, 80), quantity: Number(m[1]) } : { type: l.slice(0, 80), quantity: 1 }; });
  return { ...(v.amount !== undefined ? { money: { currency: v.currency, amount: v.amount } } : {}), deliverables, start_on: v.start_on, end_on: v.end_on, revisions: v.revisions ?? 0,
    rights: { usage_months: v.usage_months, channels: v.channels, exclusivity_days: v.exclusivity_days ?? 0 } };
}
export const questionsForm = z.string().optional().transform((v) => (v ?? "").split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 10).map((l) => {
  const required = l.startsWith("*"); const yesNo = /\(yes\/no\)\s*$/i.test(l);
  return { prompt: l.replace(/^\*\s*/, "").replace(/\s*\(yes\/no\)\s*$/i, "").slice(0, 300), required, kind: yesNo ? "yes_no" : "text" };
}));
