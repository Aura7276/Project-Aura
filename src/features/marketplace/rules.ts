// M10 labels and honest formatting of campaign terms. Money, products, services, experiences and commission are always shown separately (F18).
export const categories = {
  paid: "Paid",
  ugc: "UGC",
  barter: "Barter",
  affiliate: "Affiliate",
  ambassador: "Ambassador",
  event: "Events",
} as const;
export type Category = keyof typeof categories;
export const categoryHelp: Record<Category, string> = {
  paid: "Guaranteed money for agreed content.",
  ugc: "Content made for the Brand to use; no follower minimum.",
  barter: "Products or services instead of money.",
  affiliate: "Commission on sales you drive; earnings are not guaranteed.",
  ambassador: "A longer relationship with a Brand.",
  event: "Attend or host an event or experience.",
};
export const visibilities = {
  public: "Public: every signed-in Creator",
  restricted: "Restricted: only Creators who meet every requirement",
  invite_only: "Invitation only: Creators you invite",
} as const;
export const statuses = {
  draft: "Draft",
  in_review: "Under review",
  published: "Live",
  paused: "Paused",
  closed: "Closed",
  removed: "Removed",
} as const;
export const reportReasons = {
  fee_requested: "Asks me to pay a fee or deposit",
  misleading_terms: "Terms are misleading",
  unsafe: "Unsafe or suspicious",
  inappropriate: "Inappropriate content",
  spam: "Spam",
  other: "Something else",
} as const;
export const changeLabels: Record<string, string> = {
  compensation: "compensation",
  deliverables: "deliverables",
  rights: "rights or exclusivity",
  requirements: "requirements",
  closes_at: "deadline",
  positions: "positions",
  travel: "travel",
  countries: "countries",
  languages: "languages",
  remote: "remote work",
};
export type Money = {
  type: "fixed" | "range" | "none";
  currency?: string;
  min?: number;
  max?: number;
  negotiable?: boolean;
};
export type Compensation = {
  money?: Money;
  products?: { description?: string; value?: number | null };
  services?: { description?: string };
  experiences?: { description?: string };
  commission?: { rate_pct?: number; terms?: string };
};
export type Rights = {
  usage_months?: number | null;
  channels?: string[];
  whitelisting?: boolean;
  exclusivity_days?: number;
  exclusivity_scope?: string;
  negotiable?: boolean;
};
export type Deliverable = {
  type: string;
  platform?: string;
  quantity?: number;
  notes?: string;
};
export const fmtMoney = (
  currency: string | undefined,
  n: number | undefined | null,
) =>
  n === undefined || n === null
    ? ""
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: currency ?? "INR",
        maximumFractionDigits: 0,
      }).format(n);
export function moneyText(m: Money | undefined): string | null {
  if (!m || m.type === "none") return null;
  const base =
    m.type === "fixed"
      ? fmtMoney(m.currency, m.min)
      : `${fmtMoney(m.currency, m.min)} to ${fmtMoney(m.currency, m.max)}`;
  return m.negotiable ? `${base} (negotiable)` : base;
}
/** Each kind of compensation as its own line, never merged into one "value". */
export function compensationParts(
  c: Compensation | undefined,
): { kind: string; text: string; guaranteed: boolean }[] {
  const out: { kind: string; text: string; guaranteed: boolean }[] = [];
  const m = moneyText(c?.money);
  if (m) out.push({ kind: "Money", text: m, guaranteed: true });
  if (c?.products?.description)
    out.push({
      kind: "Products",
      text:
        c.products.description +
        (c.products.value
          ? ` (Brand-stated value ${fmtMoney("INR", c.products.value)})`
          : ""),
      guaranteed: false,
    });
  if (c?.services?.description)
    out.push({
      kind: "Services",
      text: c.services.description,
      guaranteed: false,
    });
  if (c?.experiences?.description)
    out.push({
      kind: "Experience",
      text: c.experiences.description,
      guaranteed: false,
    });
  if (c?.commission?.rate_pct)
    out.push({
      kind: "Commission",
      text: `${c.commission.rate_pct}% of attributed sales${c.commission.terms ? ` (${c.commission.terms})` : ""}. Not guaranteed.`,
      guaranteed: false,
    });
  return out;
}
export function rightsText(r: Rights | undefined): string {
  if (!r || (r.negotiable && r.usage_months == null))
    return "Usage rights: negotiable (not yet stated).";
  const parts = [
    r.usage_months
      ? `${r.usage_months} months of usage`
      : "Usage period not stated",
    r.channels?.length ? `on ${r.channels.join(", ")}` : "",
    r.whitelisting ? "including paid ads from your account" : "",
  ].filter(Boolean);
  const ex = r.exclusivity_days
    ? `Exclusivity: ${r.exclusivity_days} days${r.exclusivity_scope ? ` (${r.exclusivity_scope})` : ""}.`
    : "No exclusivity.";
  return `${parts.join(" ")}. ${ex}${r.negotiable ? " Negotiable." : ""}`;
}
export const positionsText = (p: number | null | undefined) =>
  p
    ? `${p} position${p === 1 ? "" : "s"}`
    : "Number of positions not disclosed";
export const deliverableText = (d: Deliverable) =>
  `${d.quantity ?? 1} × ${d.type}${d.platform ? ` on ${d.platform}` : ""}${d.notes ? ` (${d.notes})` : ""}`;
export const deliverableCount = (ds: Deliverable[] | undefined) =>
  (ds ?? []).reduce((n, d) => n + (d.quantity ?? 1), 0);
export const daysLeft = (iso: string, now = Date.now()) =>
  Math.ceil((Date.parse(iso) - now) / 86_400_000);
