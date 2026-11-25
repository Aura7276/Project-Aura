import { buildChecklist } from "@/features/creator-onboarding/checklist";
import { evaluateEligibility } from "@/features/creator-onboarding/eligibility";
import { goalCategories, label } from "@/features/creator-onboarding/taxonomy";
import type { CreatorState } from "@/features/creator-onboarding/types";
import { articles } from "@/features/public-site/resources";
import { wantsUgc } from "./personalization";
import type { Observation } from "./types";

export type ActionCandidate = {
  rule_key: string;
  category:
    | "growth_plan"
    | "content"
    | "profile"
    | "observation"
    | "education"
    | "commercial"
    | "weekly";
  title: string;
  detail: string;
  href: string | null;
  dependency: string | null;
  plan_action_id: string | null;
  priority: number;
};
export type ActionInput = {
  state: CreatorState;
  ideasTotal: number;
  lastIdeaDaysAgo: number | null;
  observations: Observation[];
  today: string;
  isoWeekday: number;
  recentCompleted: ReadonlySet<string>;
  hasClosedReview: boolean;
};
const daysBetween = (from: string, to: string) =>
  Math.floor(
    (Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) /
      86_400_000,
  );
const slugs = new Set(articles.map((a) => a.slug));
function article(state: CreatorState): string {
  const ch = new Set(state.challenges.map((c) => c.code)),
    g = new Set(state.goals.map((x) => x.category));
  const pick =
    ch.has("hooks") || ch.has("engagement") || ch.has("content_quality")
      ? "compare-two-hooks"
      : ch.has("portfolio") ||
          ch.has("finding_brands") ||
          g.has("brand_collaborations") ||
          g.has("ugc") ||
          g.has("professional_profile")
        ? "build-your-media-kit"
        : "compare-two-hooks";
  return slugs.has(pick) ? pick : articles[0].slug;
}
/**
 * Deterministic daily-action rules (documented in CREATOR_STUDIO_ARCHITECTURE.md). Each rule fires only from real persisted data
 * and links only to routes that exist; anything depending on an unbuilt module carries that dependency. Not AI-generated.
 */
export function candidates(i: ActionInput): ActionCandidate[] {
  const { state: s } = i;
  const c: ActionCandidate[] = [];
  const add = (
    x: Omit<ActionCandidate, "dependency" | "plan_action_id"> &
      Partial<Pick<ActionCandidate, "dependency" | "plan_action_id">>,
  ) => c.push({ dependency: null, plan_action_id: null, ...x });
  const challenges = new Set(s.challenges.map((x) => x.code));
  const goals = new Set(s.goals.map((x) => x.category));
  const checklist = buildChecklist(s);

  const nextPlan = s.plan?.actions
    .filter((a) => a.status !== "done")
    .sort((a, b) => (a.position ?? 99) - (b.position ?? 99))[0];
  if (nextPlan?.id)
    add({
      rule_key: `plan:${nextPlan.id}`,
      category: "growth_plan",
      title: nextPlan.title,
      detail: nextPlan.detail,
      href: "/creator/dashboard",
      priority: 100,
      plan_action_id: nextPlan.id,
    });

  if (i.isoWeekday === 1 && i.hasClosedReview)
    add({
      rule_key: "weekly_review",
      category: "weekly",
      title: "Read last week’s review",
      detail:
        "See what you recorded last week and pick one focus for this week.",
      href: "/creator/progress",
      priority: 90,
    });

  const measured = s.goals.filter((g) => g.metric);
  for (const g of measured) {
    const latest = i.observations
      .filter((o) => o.category === g.category && o.metric === g.metric)
      .map((o) => o.observed_on)
      .sort()
      .pop();
    const age = latest ? daysBetween(latest, i.today) : null;
    if (age === null || age >= 7)
      add({
        rule_key: `observe:${g.category}.${g.metric}`.slice(0, 60),
        category: "observation",
        title: `Record where you are: ${label(goalCategories, g.category).toLowerCase()}`,
        detail:
          age === null
            ? "You have not recorded anything yet. Enter your current number. It stays private."
            : `Your last entry was ${age} days ago. Add a fresh number.`,
        href: "/creator/progress",
        priority: age === null ? 85 : 80,
      });
  }
  if (s.goals.length && !measured.length)
    add({
      rule_key: "measure",
      category: "observation",
      title: "Choose something to measure",
      detail:
        "Add a number you can track, such as posts per week. You can leave the target blank.",
      href: "/onboarding/creator/goals",
      priority: 60,
    });

  if (i.ideasTotal < 3 || (i.lastIdeaDaysAgo ?? 99) >= 7)
    add({
      rule_key: "idea",
      category: "content",
      title: "Capture one content idea",
      detail: "One line is enough. It stays in your private ideas list.",
      href: "/creator/create",
      priority: challenges.has("content_ideas") ? 88 : 70,
    });

  if (
    goals.has("consistency") ||
    challenges.has("consistency") ||
    challenges.has("time")
  )
    add({
      rule_key: "schedule",
      category: "content",
      title: "Choose your creating days this week",
      detail:
        "Note which days you will make something. Calendar planning arrives with Content Studio, so keep it simple for now.",
      href: null,
      dependency: "M08",
      priority: 65,
    });

  const todo = checklist.find(
    (x) => x.group === "optional" && x.state === "todo" && x.href,
  );
  if (todo)
    add({
      rule_key: `profile:${todo.id}`,
      category: "profile",
      title: todo.label.replace(" (optional)", ""),
      detail: "Optional. It helps tailor your suggestions.",
      href: todo.href,
      priority: 50,
    });

  const slug = article(s);
  add({
    rule_key: `read:${slug}`.slice(0, 60),
    category: "education",
    title: articles.find((a) => a.slug === slug)!.title,
    detail: "A short guide you can use today.",
    href: `/resources/${slug}`,
    priority: 55,
  });

  const e = evaluateEligibility(s);
  if (
    s.collaborations.some((x) => x.interested && x.category !== "ugc") &&
    e.standardInfluencer.status !== "meets_follower_rule_unverified"
  )
    add({
      rule_key: "eligibility",
      category: "commercial",
      title: "See what standard collaborations need",
      detail: "A short explanation of the requirements and how to get ready.",
      href: "/creator/recommendations",
      priority: 45,
    });
  if (wantsUgc(s))
    add({
      rule_key: "ugc_prep",
      category: "commercial",
      title: "Draft two sample UGC ideas",
      detail:
        "Save them as ideas for now. Portfolio tools arrive with the profile module.",
      href: "/creator/create",
      dependency: "M09",
      priority: s.profile?.stage === "ugc_focused" ? 75 : 48,
    });
  return c;
}
const fallbacks: ActionCandidate[] = [
  {
    rule_key: "reflect",
    category: "content",
    title: "Note one thing you learned this week",
    detail: "A single sentence saved as an idea is enough.",
    href: "/creator/create",
    dependency: null,
    plan_action_id: null,
    priority: 10,
  },
  {
    rule_key: "read:compare-two-hooks",
    category: "education",
    title: "Test two openings for one idea",
    detail: "A short guide to a small, useful experiment.",
    href: "/resources/compare-two-hooks",
    dependency: null,
    plan_action_id: null,
    priority: 9,
  },
  {
    rule_key: "review_goals",
    category: "observation",
    title: "Review your goals",
    detail: "Check that your goals still feel right. Edit them if not.",
    href: "/onboarding/creator/goals",
    dependency: null,
    plan_action_id: null,
    priority: 8,
  },
];
/** Chooses three to five distinct actions. Rules completed in the last three days are rotated out, except growth-plan actions. */
export function generateDailyActions(i: ActionInput): ActionCandidate[] {
  const ranked = candidates(i)
    .filter(
      (x) => x.category === "growth_plan" || !i.recentCompleted.has(x.rule_key),
    )
    .sort(
      (a, b) => b.priority - a.priority || a.rule_key.localeCompare(b.rule_key),
    );
  const picked: ActionCandidate[] = [];
  for (const x of ranked)
    if (picked.length < 5 && !picked.some((p) => p.rule_key === x.rule_key))
      picked.push(x);
  for (const f of fallbacks)
    if (picked.length < 3 && !picked.some((p) => p.rule_key === f.rule_key))
      picked.push(f);
  return picked.slice(0, 5);
}
export const toPayload = (list: ActionCandidate[]) =>
  list.map((x) => ({
    rule_key: x.rule_key,
    category: x.category,
    title: x.title,
    detail: x.detail,
    href: x.href,
    dependency: x.dependency,
    plan_action_id: x.plan_action_id,
  }));
