// Illustrative records used ONLY by the development preview. They are not real Creators and never reach production.
import type {
  CreatorState,
  Goal,
  SocialAccount,
} from "@/features/creator-onboarding/types";
import { generateDailyActions } from "@/features/creator-studio/daily-actions";
import { unavailableCommercial } from "@/features/creator-studio/commercial";
import type { DailyAction, Observation } from "@/features/creator-studio/types";
import type { StudioData } from "@/features/creator-studio/views";

export type Situation = "aspiring" | "below100" | "qualifying" | "ugc";
const today = "2026-11-25";
const goal = (o: Partial<Goal>): Goal => ({
  category: "audience_growth",
  metric: null,
  baseline_kind: "unknown",
  baseline_value: null,
  target_value: null,
  currency: null,
  timeframe_days: null,
  details: null,
  ...o,
});
const account = (
  followers: number | null,
  o: Partial<SocialAccount> = {},
): SocialAccount => ({
  platform: "instagram",
  handle: "illustrative",
  profile_url: null,
  account_type: "personal",
  ownership_scope: "individual",
  visibility: "public",
  self_reported_followers: followers,
  observed_on: followers === null ? null : "2026-11-01",
  is_primary: true,
  ...o,
});
const base = (): CreatorState => ({
  workspace_id: "preview",
  profile: {
    display_name: "Illustrative Creator",
    country: "IN",
    city: null,
    language: "en",
    bio: null,
    stage: "aspiring",
    niche_exploring: false,
    prior_collaboration: null,
    restrictions: null,
    visibility: "private",
    activated_at: "2026-11-10T09:00:00Z",
    updated_at: "2026-11-20T00:00:00Z",
  },
  onboarding: {
    revision: 5,
    current_step: "review",
    ai_assisted: false,
    steps: {
      identity: "completed",
      niche: "completed",
      goals: "completed",
      social: "completed",
      challenges: "skipped",
    },
  },
  niches: [{ role: "primary", code: "food", custom_label: null }],
  social_accounts: [],
  goals: [goal({})],
  challenges: [{ code: "consistency", detail: null }],
  resources: null,
  collaborations: [],
  industry_preferences: [],
  industry_exclusions: [{ industry: "alcohol", note: null }],
  rates: [],
  plan: {
    id: "p",
    version: 1,
    label: "rule_based_initial_guidance",
    basis: {},
    created_at: "2026-11-10T09:00:00Z",
    actions: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        position: 1,
        day: 1,
        title: "Write down three themes within Food",
        detail:
          "Pick topics you could talk about for a few minutes without notes.",
        status: "done",
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        position: 2,
        day: 2,
        title: "Choose one platform to start on",
        detail: "One platform is enough for now.",
        status: "todo",
      },
      {
        id: "33333333-3333-4333-8333-333333333333",
        position: 3,
        day: 3,
        title: "Build a list of ten content ideas",
        detail: "Short notes are fine.",
        status: "todo",
      },
    ],
  },
});
export function stateFor(s: Situation): CreatorState {
  const b = base();
  if (s === "below100")
    return {
      ...b,
      profile: { ...b.profile!, stage: "emerging" },
      social_accounts: [
        account(60),
        account(60, {
          handle: "second",
          platform: "youtube",
          account_type: null,
          is_primary: false,
        }),
      ],
      goals: [
        goal({
          metric: "follower_count",
          baseline_kind: "self_reported",
          baseline_value: 40,
          target_value: 100,
          timeframe_days: 60,
        }),
        goal({
          category: "consistency",
          metric: "posts_per_week",
          target_value: 3,
        }),
      ],
    };
  if (s === "qualifying")
    return {
      ...b,
      profile: { ...b.profile!, stage: "growing" },
      social_accounts: [account(1500)],
      collaborations: [{ category: "paid_influencer", interested: true }],
      goals: [
        goal({
          metric: "follower_count",
          baseline_kind: "self_reported",
          baseline_value: 1200,
          target_value: 2500,
          timeframe_days: 90,
        }),
      ],
    };
  if (s === "ugc")
    return {
      ...b,
      profile: { ...b.profile!, stage: "ugc_focused" },
      collaborations: [{ category: "ugc", interested: true }],
      goals: [goal({ category: "ugc" })],
    };
  return b;
}
const obs = (
  category: string,
  metric: string,
  value: number,
  observed_on: string,
  n: number,
): Observation => ({
  id: `o${n}`,
  category,
  metric,
  value,
  observed_on,
  source: "self_reported",
  note: null,
  created_at: observed_on + "T09:00:00Z",
});
export function dataFor(s: Situation): StudioData {
  const state = stateFor(s);
  const observations: Observation[] =
    s === "below100"
      ? [
          obs("audience_growth", "follower_count", 40, "2026-11-01", 1),
          obs("audience_growth", "follower_count", 55, "2026-11-12", 2),
          obs("audience_growth", "follower_count", 62, "2026-11-23", 3),
        ]
      : s === "qualifying"
        ? [obs("audience_growth", "follower_count", 1200, "2026-10-01", 4)]
        : [];
  const gen = generateDailyActions({
    state,
    ideasTotal: s === "aspiring" ? 0 : 2,
    lastIdeaDaysAgo: s === "aspiring" ? null : 3,
    observations,
    today,
    isoWeekday: 3,
    recentCompleted: new Set(),
    hasClosedReview: false,
  });
  const todayActions: DailyAction[] = gen.map((g, i) => ({
    id: `00000000-0000-4000-8000-00000000000${i + 1}`,
    local_date: today,
    rule_key: g.rule_key,
    category: g.category,
    title: g.title,
    detail: g.detail,
    href: g.href,
    dependency: g.dependency,
    source: g.plan_action_id ? "growth_plan" : "rule_based",
    status: i === 1 && s !== "aspiring" ? "completed" : "pending",
    status_at: i === 1 && s !== "aspiring" ? "2026-11-25T05:00:00Z" : null,
    plan_action_id: g.plan_action_id,
  }));
  const week = {
    week_start: "2026-11-23",
    week_end: "2026-11-29",
    actions: {
      assigned: todayActions.length,
      completed: s === "aspiring" ? 0 : 1,
      skipped: 0,
      deferred: 0,
    },
    observations: s === "below100" ? 1 : 0,
    ideas: 0,
    profile_updates: 0,
    goals_observed: [],
    evidence_sufficient: s !== "aspiring",
  };
  return {
    state,
    prefs: { hidden_widgets: [], gamification_enabled: true, today },
    today: todayActions,
    history: [],
    observations,
    ideas: {
      total: s === "aspiring" ? 0 : 2,
      items:
        s === "aspiring"
          ? []
          : [
              {
                id: "i1",
                title: "Street-food reel with two hooks",
                note: null,
                status: "captured",
                source: "quick_capture",
                created_at: "2026-11-22T10:00:00Z",
              },
            ],
    },
    milestones: {
      enabled: true,
      streak: {
        current: s === "aspiring" ? 0 : 1,
        longest: s === "aspiring" ? 0 : 1,
      },
      milestones: [
        { code: "onboarding_complete", achieved_at: "2026-11-10T09:00:00Z" },
      ],
    },
    weekly: {
      current: week,
      reviews: [],
      digest_opt_in: false,
      digest_delivery: "unavailable",
    },
    commercial: {
      status: "unavailable",
      module: "M13",
      text: "Agreed compensation, externally recorded payments and outstanding amounts will appear here when commercial records exist. AURA does not hold or move money.",
    },
    live: false,
  };
}
export { unavailableCommercial };
