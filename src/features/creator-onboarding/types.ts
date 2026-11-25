export type StepId =
  | "identity"
  | "social"
  | "niche"
  | "goals"
  | "challenges"
  | "preferences"
  | "rates"
  | "resources";
export type StepStatus = "completed" | "skipped";
export const mandatorySteps: StepId[] = ["identity", "niche", "goals"];
export const stepOrder: StepId[] = [
  "identity",
  "social",
  "niche",
  "goals",
  "challenges",
  "preferences",
];
export const laterSteps: StepId[] = ["rates", "resources"];
export const allSteps: StepId[] = [...stepOrder, ...laterSteps];
export type SocialAccount = {
  id?: string;
  platform: string;
  handle: string;
  profile_url: string | null;
  account_type: string | null;
  ownership_scope: "individual" | "brand_or_company";
  visibility: "public" | "private" | "unknown";
  self_reported_followers: number | null;
  observed_on: string | null;
  is_primary: boolean;
  provenance?: "self_reported";
  verification?: "unverified";
};
export type Goal = {
  category: string;
  metric: string | null;
  baseline_kind: "observed" | "self_reported" | "unknown";
  baseline_value: number | null;
  target_value: number | null;
  currency: string | null;
  timeframe_days: number | null;
  details: string | null;
};
export type PlanAction = {
  id?: string;
  position?: number;
  day: number;
  title: string;
  detail: string;
  status?: "todo" | "done";
};
export type CreatorState = {
  workspace_id: string;
  profile: null | {
    display_name: string | null;
    country: string | null;
    city: string | null;
    language: string | null;
    bio: string | null;
    stage: string | null;
    niche_exploring: boolean;
    prior_collaboration: string | null;
    restrictions: string | null;
    visibility: "private";
    activated_at: string | null;
    updated_at: string;
  };
  onboarding: null | {
    revision: number;
    current_step: string;
    steps: Partial<Record<StepId | "review", StepStatus>>;
    ai_assisted: boolean;
  };
  niches: {
    role: "primary" | "secondary" | "interest";
    code: string;
    custom_label: string | null;
  }[];
  social_accounts: SocialAccount[];
  goals: Goal[];
  challenges: { code: string; detail: string | null }[];
  resources: null | {
    hours_per_week: number | null;
    posts_per_week: number | null;
    equipment: string[];
    budget_minor: number | null;
    budget_currency: string | null;
  };
  collaborations: { category: string; interested: boolean }[];
  industry_preferences: {
    industry: string;
    stance: "preferred" | "considering";
  }[];
  industry_exclusions: { industry: string; note: string | null }[];
  rates: {
    format: string;
    amount_minor: number | null;
    currency: string;
    negotiable: boolean;
    unsure: boolean;
  }[];
  plan: null | {
    id: string;
    version: number;
    label: "rule_based_initial_guidance";
    basis: Record<string, unknown>;
    created_at: string;
    actions: PlanAction[];
  };
};
