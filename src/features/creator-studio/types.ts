export const widgetIds = [
  "actions",
  "plan",
  "goals",
  "content",
  "checklist",
  "recommendations",
  "commercial",
  "milestones",
  "weekly",
  "social",
  "analytics",
  "profile",
] as const;
export type WidgetId = (typeof widgetIds)[number];
export const widgetLabels: Record<WidgetId, string> = {
  actions: "Daily actions",
  plan: "Growth plan summary",
  goals: "Goal progress",
  content: "Content overview",
  checklist: "Profile checklist",
  recommendations: "Opportunity recommendations",
  commercial: "Commercial summary",
  milestones: "Milestones",
  weekly: "Weekly review",
  social: "Social accounts",
  analytics: "Analytics and experiments",
  profile: "Profile and media kit",
};
export type Prefs = {
  hidden_widgets: WidgetId[];
  gamification_enabled: boolean;
  digest_opt_in: boolean;
  timezone: string;
  walkthrough_status: "not_seen" | "completed" | "dismissed";
  walkthrough_at: string | null;
  updated_at: string;
  today: string;
};
export type ActionStatus = "pending" | "completed" | "skipped" | "deferred";
export type DailyAction = {
  id: string;
  local_date: string;
  rule_key: string;
  category: string;
  title: string;
  detail: string;
  href: string | null;
  dependency: string | null;
  source: "rule_based" | "growth_plan";
  status: ActionStatus;
  status_at: string | null;
  plan_action_id: string | null;
};
export type Observation = {
  id: string;
  category: string;
  metric: string;
  value: number;
  observed_on: string;
  source: "self_reported";
  note: string | null;
  created_at: string;
};
export type Idea = {
  id: string;
  title: string;
  note: string | null;
  status: "captured";
  source: "quick_capture";
  created_at: string;
};
export type Milestones = {
  enabled: boolean;
  streak: { current: number; longest: number } | null;
  milestones: { code: string; achieved_at: string }[];
};
export type WeekSummary = {
  week_start: string;
  week_end: string;
  actions: {
    assigned: number;
    completed: number;
    skipped: number;
    deferred: number;
  };
  observations: number;
  ideas: number;
  profile_updates: number;
  goals_observed: {
    category: string;
    metric: string;
    first: number;
    last: number;
    count: number;
  }[];
  evidence_sufficient: boolean;
};
export type Weekly = {
  current: WeekSummary;
  reviews: { week_start: string; summary: WeekSummary; generated_at: string }[];
  digest_opt_in: boolean;
  digest_delivery: "unavailable";
};
export type SearchHit = {
  type: "idea" | "action" | "plan" | "goal" | "observation";
  id: string;
  title: string;
  snippet: string;
  href: string;
};
export const milestoneLabels: Record<
  string,
  { title: string; detail: string }
> = {
  onboarding_complete: {
    title: "Workspace activated",
    detail: "You finished the required onboarding steps.",
  },
  first_action_completed: {
    title: "First action completed",
    detail: "You completed your first daily action.",
  },
  first_observation_recorded: {
    title: "First progress recorded",
    detail: "You recorded your first progress observation.",
  },
  first_idea_captured: {
    title: "First idea captured",
    detail: "You saved your first content idea.",
  },
};
