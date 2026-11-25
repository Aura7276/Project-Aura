import { stepStatus, missingMandatory } from "./progress";
import type { CreatorState, StepId } from "./types";

export type ChecklistItem = {
  id: string;
  label: string;
  group: "required" | "optional" | "later";
  state: "done" | "skipped" | "todo" | "unavailable";
  href: string | null;
  note?: string;
};
const base = "/onboarding/creator";
/** Derived only from persisted data. Skipped optional items are never penalized and there is no quality score. */
export function buildChecklist(state: CreatorState): ChecklistItem[] {
  const missing = missingMandatory(state);
  const req = (id: StepId, text: string): ChecklistItem => ({
    id,
    label: text,
    group: "required",
    state: missing.includes(id) ? "todo" : "done",
    href: `${base}/${id}`,
  });
  const opt = (id: StepId, text: string, doneWhen: boolean): ChecklistItem => {
    const s = stepStatus(state, id);
    return {
      id,
      label: text,
      group: "optional",
      state: doneWhen ? "done" : s === "skipped" ? "skipped" : "todo",
      href: `${base}/${id}`,
    };
  };
  return [
    req("identity", "Complete your basic profile"),
    req("niche", "Choose a primary niche"),
    req("goals", "Set your growth goals"),
    opt(
      "social",
      "Add a social account (optional)",
      state.social_accounts.length > 0,
    ),
    opt("challenges", "Tell us your challenges", state.challenges.length > 0),
    opt(
      "preferences",
      "Add collaboration preferences",
      state.collaborations.some((c) => c.interested),
    ),
    opt("resources", "Add your time and tools", !!state.resources),
    opt("rates", "Add optional rates", state.rates.length > 0),
    {
      id: "portfolio",
      label: "Prepare portfolio information",
      group: "later",
      state: "unavailable",
      href: null,
      note: "Available when the Creator profile and media kit module (M09) is built.",
    },
    {
      id: "verification",
      label: "Verify your social accounts when needed",
      group: "later",
      state: "unavailable",
      href: null,
      note: "Available when social account management (M05) is built.",
    },
  ];
}
export function checklistSummary(items: ChecklistItem[]) {
  const required = items.filter((i) => i.group === "required");
  const optional = items.filter((i) => i.group === "optional");
  return {
    requiredDone: required.filter((i) => i.state === "done").length,
    requiredTotal: required.length,
    optionalAddressed: optional.filter(
      (i) => i.state === "done" || i.state === "skipped",
    ).length,
    optionalTotal: optional.length,
  };
}
