import {
  aiAvailability,
  type AiOnboardingProvider,
} from "@/features/creator-onboarding/ai";
// Contract for the persistent assistant. M07 supplies the real provider. Nothing here simulates a conversation.
export type AssistantContext = { workspaceName: string; page: string };
export interface GrowthAssistant {
  ask(context: AssistantContext, message: string): Promise<{ reply: string }>;
}
export function assistantAvailability(
  provider: AiOnboardingProvider | null = null,
) {
  const a = aiAvailability(provider);
  return a.available
    ? { available: true as const }
    : {
        available: false as const,
        reason:
          "Open Growth Studio to draft, review and manage your plans. Automatic suggestions require a configured AI provider.",
      };
}
export const assistantManualTools = [
  { label: "Today’s actions", href: "/creator/actions" },
  { label: "Record progress", href: "/creator/progress" },
  { label: "Capture an idea", href: "/creator/create" },
  { label: "Read a guide", href: "/resources" },
] as const;
