// Integration contract for optional AI-assisted onboarding. M07 owns the real infrastructure and provider.
// Nothing here simulates a conversation: with no provider the AI path is reported unavailable.
export type ExtractedSuggestion = {
  section: string;
  fields: Record<string, unknown>;
};
export interface AiOnboardingProvider {
  /** Returns suggestions only. The caller must show them for confirmation before any persistence. */
  suggest(input: { transcript: string }): Promise<ExtractedSuggestion[]>;
}
export type AiAvailability =
  | { available: false; reason: string }
  | { available: true; provider: AiOnboardingProvider };
export function aiAvailability(
  provider: AiOnboardingProvider | null = null,
): AiAvailability {
  return provider
    ? { available: true, provider }
    : {
        available: false,
        reason:
          "AI-assisted onboarding is not available yet. The guided questions below cover everything you need.",
      };
}
