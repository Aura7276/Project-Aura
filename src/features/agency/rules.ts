// M23 interface rules: what each delegated area means, labels, and readable activity. The database enforces every rule.
import type { Scope } from "@/server/agency/service";

export const scopeOrder: Scope[] = [
  "view",
  "profile",
  "campaigns",
  "applications",
  "content",
  "results",
  "assistant",
];
export const scopeInfo: Record<
  Scope,
  { label: string; brand: string; creator: string }
> = {
  view: {
    label: "View",
    brand:
      "Read your business, campaigns, applicants, content and results. No changes.",
    creator:
      "Read your profile, applications, content and results. No changes.",
  },
  profile: {
    label: "Profile",
    brand: "Edit your business profile, products, audiences, goals and plan.",
    creator: "Edit your profile, rates and social accounts.",
  },
  campaigns: {
    label: "Campaigns",
    brand: "Create, edit and publish campaigns.",
    creator: "Browse and save campaigns for you.",
  },
  applications: {
    label: "Applications",
    brand: "Review applicants, shortlist, offer places and negotiate.",
    creator: "Draft and submit applications and negotiate.",
  },
  content: {
    label: "Content",
    brand: "Plan, write and schedule your own content.",
    creator: "Plan and write content in your studio.",
  },
  results: {
    label: "Results",
    brand: "Record and report campaign results.",
    creator: "Record results and manage analytics.",
  },
  assistant: {
    label: "Assistant",
    brand:
      "Use the AI assistant for you. Includes reading your assistant conversations.",
    creator: "Use the AI growth assistant for you.",
  },
};
export const neverDelegated = [
  "Accepting data-sharing, consent or audience grants",
  "Verifying your identity, business or social accounts",
  "Deleting your workspace or profile",
  "Changing what an Agency may do (only you can)",
];
export const kindLabels: Record<string, string> = {
  talent: "Talent management",
  brand: "Brand services",
  hybrid: "Talent and brand services",
  consultant: "Independent consultant",
};
export const serviceLabels: Record<string, string> = {
  talent_management: "Talent management",
  campaign_management: "Campaign management",
  content_production: "Content production",
  social_management: "Social media management",
  ugc: "UGC production",
  strategy: "Strategy",
  reporting: "Reporting",
  paid_media: "Paid media",
};
export const registrationLabels: Record<string, string> = {
  gst: "GST",
  cin: "Company (CIN)",
  llp: "LLP",
  udyam: "Udyam (MSME)",
  individual: "Individual (PAN)",
  other: "Other",
};
export const feeKinds: Record<string, string> = {
  retainer: "Retainer",
  commission: "Commission",
  project_fee: "Project fee",
  expense: "Rebilled expense",
};
export const feeStatus: Record<string, string> = {
  planned: "Planned",
  invoiced: "Invoiced",
  paid: "Paid",
  cancelled: "Cancelled",
};
export const verificationLabels: Record<string, string> = {
  draft: "Not submitted",
  submitted: "With a reviewer",
  info_requested: "More information needed",
  verified: "Verified",
  rejected: "Not approved",
};
const areaOf: [RegExp, string][] = [
  [/^aura_brand_content_/, "Content"],
  [/^aura_brand_ai_/, "Assistant"],
  [/^aura_brand_/, "Business profile"],
  [/^aura_(market|campaign)_/, "Campaigns"],
  [/^aura_selection_/, "Selection"],
  [/^aura_apply_/, "Applications"],
  [/^aura_monitor_/, "Results"],
  [/^aura_analytics_/, "Analytics"],
  [/^aura_(studio|content)_/, "Studio"],
  [/^aura_growth_/, "Growth assistant"],
  [/^aura_(profile|social)_/, "Profile"],
];
/** "aura_brand_content_create" → "Content · create". */
export function actionLabel(fn: string) {
  const area = areaOf.find(([r]) => r.test(fn));
  const rest = fn
    .replace(
      /^aura_(brand_content|brand_ai|brand|market|campaign|selection|apply|monitor|analytics|studio|content|growth|profile|social)_/,
      "",
    )
    .replace(/_/g, " ");
  return `${area?.[1] ?? "Action"} · ${rest}`;
}
export const money = (currency: string, amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
/** Totals per currency (amounts in different currencies are never added together). */
export function totals(
  fees: { currency: string; amount: number; status: string }[],
  status?: string,
) {
  const out: Record<string, number> = {};
  for (const f of fees)
    if (f.status !== "cancelled" && (!status || f.status === status))
      out[f.currency] = (out[f.currency] ?? 0) + Number(f.amount);
  return Object.entries(out).map(([c, a]) => money(c, a));
}
export function expiryText(
  g: { expires_at: string; days_left: number; expired: boolean } | null,
) {
  if (!g) return "No access";
  if (g.expired) return "Expired";
  if (g.days_left <= 14)
    return `Ends in ${g.days_left} day${g.days_left === 1 ? "" : "s"}`;
  return `Until ${new Date(g.expires_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}`;
}
export const scopesText = (s: Scope[]) =>
  scopeOrder
    .filter((x) => s.includes(x))
    .map((x) => scopeInfo[x].label)
    .join(", ");
