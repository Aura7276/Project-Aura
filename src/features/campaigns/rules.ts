// M17 campaign builder: steps, the fields each step edits, rollout labels and the publish readiness check.
import type { BrandCampaign } from "@/features/marketplace/types";

export const steps = [
  {
    key: "objective",
    label: "Objective and audience",
    lead: "Why this campaign exists and who it is for. Private to your team.",
  },
  {
    key: "brief",
    label: "Brief",
    lead: "What Creators read first: title, summary, brief and dates.",
  },
  {
    key: "deliverables",
    label: "Deliverables",
    lead: "What each Creator makes, on which platform, and how many places you have.",
  },
  {
    key: "compensation",
    label: "Compensation and rights",
    lead: "What Creators receive, how you may use the content, and any exclusivity.",
  },
  {
    key: "eligibility",
    label: "Eligibility",
    lead: "Mandatory requirements decide who can apply; preferences only guide matching.",
  },
  {
    key: "review",
    label: "Preview and publish",
    lead: "Exactly what Creators will see, and anything still missing.",
  },
] as const;
export type StepKey = (typeof steps)[number]["key"];
/** Which M10 editor fields each builder step edits. Every other field is carried unchanged, so a step never blanks the rest. */
export const stepFields: Record<
  "brief" | "deliverables" | "compensation" | "eligibility",
  string[]
> = {
  brief: [
    "visibility",
    "title",
    "summary",
    "brief",
    "closes_on",
    "starts_on",
    "show_applicant_count",
  ],
  deliverables: ["deliverables", "effort_note", "positions"],
  compensation: [
    "money_type",
    "currency",
    "money_min",
    "money_max",
    "money_negotiable",
    "products",
    "product_value",
    "services",
    "experiences",
    "commission_pct",
    "commission_terms",
    "usage_months",
    "channels",
    "whitelisting",
    "exclusivity_days",
    "exclusivity_scope",
    "rights_negotiable",
  ],
  eligibility: [
    "travel_required",
    "travel_covered",
    "remote",
    "min_followers",
    "platforms",
    "verified_ownership",
    "countries",
    "languages",
    "niches",
    "beginner_friendly",
  ],
};
/** Which M10 validation errors belong to which step, so the readiness list links to the right place. */
export const errorStep: Record<string, StepKey> = {
  title: "brief",
  summary: "brief",
  brief: "brief",
  closes_at: "brief",
  deliverables: "deliverables",
  positions: "deliverables",
  money: "compensation",
  currency: "compensation",
  paid_needs_money: "compensation",
  affiliate_needs_commission: "compensation",
  compensation: "compensation",
  event_needs_experience: "compensation",
  rights: "compensation",
  exclusivity: "compensation",
  ugc_no_follower_minimum: "eligibility",
  min_followers: "eligibility",
};
export type Rollout = Record<string, "live" | "planned">;
export const rolloutLabel = (r: Rollout, cat: string) =>
  r[cat] === "live" ? "Live" : "Draft only, opens later";
export const objectives = {
  awareness: "Awareness",
  social_growth: "Social growth",
  content: "Content for our channels",
  engagement: "Engagement",
  conversion: "Sales or sign-ups",
} as const;

export type Readiness = {
  key: string;
  ok: boolean;
  text: string;
  step?: StepKey;
};
export function readiness(
  c: BrandCampaign,
  rollout: Rollout,
  errorText: Record<string, string>,
  selected: number,
): Readiness[] {
  const positions = Number(
    (c.draft as Record<string, unknown>).positions ?? NaN,
  );
  return [
    {
      key: "verified",
      ok: c.verified,
      text: c.verified ? "Business verified" : "Business verification approved",
    },
    {
      key: "type",
      ok: rollout[c.category] === "live",
      text:
        rollout[c.category] === "live"
          ? "Campaign type is open"
          : "This campaign type opens later; keep it as a draft for now",
    },
    ...c.errors.map((e) => ({
      key: e,
      ok: false,
      text: `Add ${errorText[e] ?? e}`,
      step: errorStep[e],
    })),
    ...(c.errors.length === 0
      ? [{ key: "terms", ok: true, text: "Every required term is complete" }]
      : []),
    ...(Number.isFinite(positions) && positions < selected
      ? [
          {
            key: "positions",
            ok: false,
            text: `At least ${selected} positions (Creators already selected)`,
            step: "deliverables" as StepKey,
          },
        ]
      : []),
  ];
}

export type Plan = {
  objective: keyof typeof objectives | null;
  kpi_metric: string | null;
  kpi_target: number | null;
  segment_ids: string[];
  product_ids: string[];
  milestones: { label: string; due_on: string | null; done: boolean }[];
  notes: string | null;
  owner_user: string | null;
  archived_at: string | null;
};
export type PlanState = {
  plan: Plan | null;
  live_type: boolean;
  selected: number;
  team: { id: string; name: string; role: string }[];
  segments: { id: string; name: string; basis: string }[];
  products: { id: string; name: string; claims: string[] }[];
  amendments: {
    version: number;
    changes: string[];
    savers: number;
    participants: number;
    at: string;
  }[];
};
export type OverviewItem = {
  id: string;
  category: string;
  visibility: string;
  status: string;
  title: string;
  closes_at: string | null;
  draft_version: number;
  published_version: number | null;
  unpublished_changes: boolean;
  positions: number | null;
  selected: number;
  applications: number;
  new_applications: number;
  saved: number;
  objective: string | null;
  owner: string | null;
  next_milestone: { label: string; due_on: string | null } | null;
  archived: boolean;
  live_type: boolean;
};

/** A starting brief built only from what the Brand confirmed in M14 (no AI, nothing invented). Used only when the brief is empty. */
export function suggestedBrief(input: {
  brand?: string;
  objective?: string | null;
  products: { name: string; claims: string[] }[];
  audiences: string[];
  dos?: string[];
  donts?: string[];
  disclosures?: string | null;
  tone?: string[];
}): string {
  const lines: string[] = [];
  if (input.brand)
    lines.push(
      `${input.brand} is looking for Creators${input.objective ? ` to help with ${input.objective.toLowerCase()}` : ""}.`,
    );
  if (input.products.length)
    lines.push(
      `Feature: ${input.products.map((p) => p.name).join(", ")}.${input.products.some((p) => p.claims.length) ? ` You may say: ${input.products.flatMap((p) => p.claims).join("; ")}.` : ""}`,
    );
  if (input.audiences.length)
    lines.push(`Our customers: ${input.audiences.join(", ")}.`);
  if (input.tone?.length) lines.push(`Tone: ${input.tone.join(", ")}.`);
  if (input.dos?.length) lines.push(`Please do: ${input.dos.join("; ")}.`);
  if (input.donts?.length)
    lines.push(`Please avoid: ${input.donts.join("; ")}.`);
  if (input.disclosures)
    lines.push(`Required disclosure: ${input.disclosures}.`);
  return lines.join("\n");
}
