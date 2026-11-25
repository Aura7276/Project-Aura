import type {
  CreatorState,
  SocialAccount,
} from "@/features/creator-onboarding/types";
export const account = (o: Partial<SocialAccount> = {}): SocialAccount => ({
  platform: "instagram",
  handle: "creator",
  profile_url: null,
  account_type: "personal",
  ownership_scope: "individual",
  visibility: "public",
  self_reported_followers: null,
  observed_on: null,
  is_primary: false,
  ...o,
});
export function state(o: Partial<CreatorState> = {}): CreatorState {
  return {
    workspace_id: "00000000-0000-4000-8000-000000000001",
    profile: {
      display_name: "Asha",
      country: "IN",
      city: null,
      language: "en",
      bio: null,
      stage: "aspiring",
      niche_exploring: false,
      prior_collaboration: null,
      restrictions: null,
      visibility: "private",
      activated_at: null,
      updated_at: "2026-11-25T00:00:00Z",
    },
    onboarding: {
      revision: 0,
      current_step: "identity",
      steps: {},
      ai_assisted: false,
    },
    niches: [],
    social_accounts: [],
    goals: [],
    challenges: [],
    resources: null,
    collaborations: [],
    industry_preferences: [],
    industry_exclusions: [],
    rates: [],
    plan: null,
    ...o,
  };
}
