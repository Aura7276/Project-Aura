// Only these real events are shown as notifications. There is no unread state, so no badge or count is ever displayed.
const sections: Record<string, string> = {
  identity: "About you",
  social: "Social accounts",
  niche: "Niche",
  goals: "Goals",
  challenges: "Challenges",
  preferences: "Preferences",
  rates: "Rates",
  resources: "Time and tools",
};
export function describeEvent(event: string): string | null {
  if (event === "workspace_created") return "Creator workspace created";
  if (event === "creator_onboarding_activated")
    return "Onboarding completed and workspace activated";
  if (event === "studio_preferences_changed")
    return "Dashboard preferences changed";
  if (event === "studio_observation_recorded")
    return "Progress observation recorded";
  const m = /^creator_section_saved:([a-z]+)$/.exec(event);
  return m && sections[m[1]] ? `Profile updated: ${sections[m[1]]}` : null;
}
