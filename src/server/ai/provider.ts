import "server-only";
import { z } from "zod";

/**
 * Provider-independent AI request (approved architecture; no provider selected). Uses the same settings and the same
 * chat-completions request shape as the M07 Growth Studio: AURA_AI_ENDPOINT, AURA_AI_API_KEY, AURA_AI_MODEL.
 * Without all three the assistant is offline and every task still works as an editable draft.
 * The endpoint must be HTTPS; redirects are refused, so the request cannot be bounced to another host.
 */
export type AiAnswer = {
  text: string;
  items: { title: string; detail?: string }[];
  assumptions: string[];
  gaps: string[];
};
export type AiOutcome =
  | { ok: true; answer: AiAnswer }
  | { ok: false; reason: "offline" | "insecure" | "unavailable" | "invalid" };
const answerSchema = z.object({
  text: z.string().trim().min(1).max(8000),
  items: z
    .array(
      z.object({
        title: z.string().trim().min(3).max(140),
        detail: z.string().trim().max(500).optional(),
      }),
    )
    .max(12)
    .default([]),
  assumptions: z.array(z.string().trim().min(1).max(300)).max(10).default([]),
  gaps: z.array(z.string().trim().min(1).max(300)).max(10).default([]),
});
export const providerConfigured = () =>
  !!(
    process.env.AURA_AI_ENDPOINT &&
    process.env.AURA_AI_API_KEY &&
    process.env.AURA_AI_MODEL
  );
const allowed = (u: URL) => u.protocol === "https:";

/** Parses the provider's reply. A plain-text reply is accepted as text with no structured items. */
export function parseAnswer(content: unknown): AiAnswer | null {
  if (typeof content !== "string" || !content.trim()) return null;
  const raw = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    const p = answerSchema.safeParse(JSON.parse(raw));
    if (p.success) return p.data;
  } catch {
    /* not JSON: fall through to plain text */
  }
  const t = z.string().trim().min(1).max(8000).safeParse(content);
  return t.success
    ? { text: t.data, items: [], assumptions: [], gaps: [] }
    : null;
}

export async function ask(system: string, user: unknown): Promise<AiOutcome> {
  const endpoint = process.env.AURA_AI_ENDPOINT,
    key = process.env.AURA_AI_API_KEY,
    model = process.env.AURA_AI_MODEL;
  if (!endpoint || !key || !model) return { ok: false, reason: "offline" };
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return { ok: false, reason: "insecure" };
  }
  if (!allowed(url)) return { ok: false, reason: "insecure" };
  try {
    const response = await fetch(url, {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
      headers: {
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1200,
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(user) },
        ],
      }),
    });
    if (!response.ok) return { ok: false, reason: "unavailable" };
    const result = (await response.json()) as {
      choices?: { message?: { content?: unknown } }[];
    };
    const answer = parseAnswer(result.choices?.[0]?.message?.content);
    return answer ? { ok: true, answer } : { ok: false, reason: "invalid" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
