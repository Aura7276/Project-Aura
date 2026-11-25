import {
  challenges as challengeList,
  goalCategories,
  label,
  niches,
} from "./taxonomy";
import { followerSegment } from "./eligibility";
import type { CreatorState, PlanAction } from "./types";

export type GeneratedPlan = {
  basis: Record<string, unknown>;
  actions: PlanAction[];
};
/** Deterministic, rule-based starter guidance. It is NOT AI-generated and makes no outcome promises. */
export function generateInitialPlan(state: CreatorState): GeneratedPlan {
  const stage = state.profile?.stage ?? "aspiring";
  const accounts = state.social_accounts;
  const primary = state.niches.find((n) => n.role === "primary");
  const nicheLabel = primary
    ? (primary.custom_label ?? label(niches, primary.code))
    : null;
  const goals = new Set(state.goals.map((g) => g.category));
  const ch = new Set(state.challenges.map((c) => c.code));
  const hours = state.resources?.hours_per_week ?? null;
  const posts = state.resources?.posts_per_week ?? null;
  const hasAccount = accounts.length > 0;
  const established =
    stage === "growing" ||
    stage === "established" ||
    (hasAccount && stage === "emerging");
  const actions: PlanAction[] = [];
  const add = (day: number, title: string, detail: string) =>
    actions.length < 7 && actions.push({ day, title, detail });

  if (!hasAccount && !established) {
    add(
      1,
      nicheLabel
        ? `Write down three themes within ${nicheLabel}`
        : "Write down three themes you would enjoy making",
      "Pick topics you could talk about for a few minutes without notes. Nothing is final.",
    );
    add(
      2,
      "Choose one platform to start on",
      "One platform is enough for now. Pick the one where you already spend time as a viewer.",
    );
  } else {
    add(
      1,
      "Review your last few posts",
      "Note which ones felt easiest to make and which got the most response. Record the numbers you can see, and leave out what you cannot.",
    );
    add(
      2,
      "Pick one content experiment",
      nicheLabel
        ? `Try one new format within ${nicheLabel} and compare it with a usual post.`
        : "Try one new format and compare it with a usual post.",
    );
  }
  if (ch.has("content_ideas") || !hasAccount)
    add(
      3,
      "Build a list of ten content ideas",
      "Short notes are fine. Sort them by how easy they are to film this week.",
    );
  else if (ch.has("hooks") || ch.has("scripts_captions"))
    add(
      3,
      "Draft three opening lines for your next posts",
      "Write two versions of each and keep the one you would stop scrolling for.",
    );
  else
    add(
      3,
      "Outline your next three posts",
      "A title and a one-line idea for each is enough.",
    );
  const cadence = posts ?? (hours !== null && hours < 3 ? 1 : 2);
  add(
    4,
    `Set a realistic schedule: ${cadence} post${cadence === 1 ? "" : "s"} a week`,
    hours !== null
      ? `You mentioned about ${hours} hours a week, so keep the plan within that.`
      : "Choose a rhythm you could keep up even during a busy week.",
  );
  if (goals.has("consistency") || ch.has("consistency"))
    add(
      5,
      "Create a simple weekly content routine",
      "Pick fixed days to plan, film and publish so it becomes a habit.",
    );
  else if (
    goals.has("brand_collaborations") ||
    goals.has("ugc") ||
    goals.has("monetization")
  )
    add(
      5,
      "Draft a short bio about what you create",
      "Two or three sentences you could later share with a Brand.",
    );
  else
    add(
      5,
      "Make a note of what inspires your content",
      "Save three creators or posts you admire and what you like about each.",
    );
  if (hasAccount)
    add(
      6,
      "Check your profile basics",
      "Make sure your photo, name and bio are clear on the account you use most.",
    );
  else
    add(
      6,
      "Record your starting point",
      "Note how many followers you have, if any, and today's date. This becomes your baseline later.",
    );
  if (
    goals.has("brand_collaborations") ||
    goals.has("monetization") ||
    goals.has("ugc")
  )
    add(
      7,
      "Read what collaboration eligibility involves",
      "Review the eligibility explanations on your onboarding summary so you know what to prepare.",
    );
  else
    add(
      7,
      "Review your week and adjust",
      "Note what worked, what did not, and what to change next week.",
    );
  const goalNames = state.goals.map((g) => label(goalCategories, g.category));
  return {
    basis: {
      generated_by: "rule_based",
      stage,
      follower_segment: followerSegment(accounts),
      has_account: hasAccount,
      niche: nicheLabel,
      goals: goalNames,
      challenges: [...ch].map((c) => label(challengeList, c)),
      uses_resources: hours !== null || posts !== null,
    },
    actions,
  };
}
export const planDisclosure =
  "Initial guidance based on your answers. It is rule-based and not AI-generated, and it does not guarantee growth, income or collaborations.";
