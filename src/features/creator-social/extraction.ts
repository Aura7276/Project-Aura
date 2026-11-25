import { aiAvailability } from "@/features/creator-onboarding/ai";
// Contract for AI-assisted screenshot extraction (provider arrives with M07). Suggestions are NOT observations: only the Creator's explicit
// confirmation creates an observation, labelled ai_confirmed. Private evidence is never sent to an unauthorized provider.
export type ExtractedField = {
  metric: string;
  value: number;
  observedOn: string;
  periodStart?: string;
  periodEnd?: string;
};
export type ExtractionSuggestion = {
  fields: ExtractedField[];
  uncertainty: Record<string, string>;
};
export interface ExtractionProvider {
  extract(input: {
    evidencePath: string;
    platform: string;
  }): Promise<ExtractionSuggestion>;
}
export function extractionAvailability(
  provider: ExtractionProvider | null = null,
) {
  const a = aiAvailability(null);
  return provider
    ? { available: true as const }
    : {
        available: false as const,
        reason: a.available
          ? ""
          : "Automatic reading of screenshots is not available yet. Type your numbers in instead. That works fully today.",
      };
}
