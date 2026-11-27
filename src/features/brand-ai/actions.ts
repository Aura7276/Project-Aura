"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { brandContext } from "@/server/market/service";
import { brandAi, type Task } from "@/server/brand-ai/service";
import { ask, providerConfigured } from "@/server/ai/provider";
import { rateLimited } from "@/server/security/rate-limit";
import { SYSTEM, request, tasks } from "./rules";

export type FormState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
} | null;
const uuid = z.uuid();
const t = (f: FormData, k: string) =>
  typeof f.get(k) === "string" ? String(f.get(k)).trim() : "";
const done = () => revalidatePath("/brand", "layout");
async function ctx(f: FormData) {
  const w = uuid.safeParse(t(f, "w"));
  return brandContext(w.success ? w.data : undefined);
}
const isTask = (v: string): v is Task => v in tasks;

export async function startConversation(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const task = t(f, "task");
  const campaign = uuid.safeParse(t(f, "campaign"));
  const request_ = uuid.safeParse(t(f, "request"));
  if (!isTask(task) || !request_.success)
    return { message: "Choose what you want help with." };
  if (tasks[task].needsCampaign && !campaign.success)
    return {
      errors: { campaign: "Choose a campaign for this task." },
      message: "Choose a campaign for this task.",
    };
  const b = await ctx(f);
  const title = t(f, "title") || tasks[task].label;
  const r = await brandAi.start(
    b.client,
    b.workspaceId,
    request_.data,
    task,
    title.slice(0, 120),
    campaign.success ? campaign.data : null,
  );
  if (!r.ok) return { message: r.message };
  done();
  redirect(`/brand/assistant/${r.value.id}?w=${b.workspaceId}`);
}

/**
 * Asks the assistant. The allowance is reserved first; the context is built by the database from this workspace's ticked sources;
 * the answer is stored with the sources, assumptions and gaps, and becomes a draft that still needs approval.
 * Offline or failing providers keep the question and leave manual drafting available.
 */
export async function askAssistant(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const conv = uuid.safeParse(t(f, "conversation"));
  const prompt = t(f, "prompt");
  if (!conv.success)
    return { message: "We could not do that. Please try again." };
  if (prompt.length < 3)
    return {
      errors: { prompt: "Write your question." },
      message: "Write your question.",
    };
  const b = await ctx(f);
  if (rateLimited("brand-ai:" + b.userId, 60))
    return {
      message: "You are going a little fast. Please try again in a moment.",
    };
  const c = await brandAi.conversation(b.client, b.workspaceId, conv.data);
  if (!c.ok) return { message: c.message };
  const horizon = [7, 30, 90].includes(Number(t(f, "horizon")))
    ? Number(t(f, "horizon"))
    : 30;
  const context = await brandAi.context(
    b.client,
    b.workspaceId,
    c.value.task,
    c.value.campaign_id,
  );
  if (!context.ok) return { message: context.message };
  const used = { sources: context.value.sources };
  if (!providerConfigured()) {
    const note =
      "The assistant is offline: no AI provider is configured. Your question is saved; you can write a draft yourself below.";
    await brandAi.record(
      b.client,
      b.workspaceId,
      conv.data,
      prompt,
      note,
      "offline",
      used,
    );
    done();
    return { message: note };
  }
  const reserve = await brandAi.reserve(b.client, b.workspaceId);
  if (!reserve.ok || reserve.value !== true) {
    await brandAi.record(
      b.client,
      b.workspaceId,
      conv.data,
      prompt,
      "This month's assistant allowance is used up. Your question is saved; you can still write a draft yourself.",
      "offline",
      used,
    );
    done();
    return {
      message:
        "This month's assistant allowance is used up. Your question is saved.",
    };
  }
  const out = await ask(
    SYSTEM,
    request(c.value.task, prompt, context.value, { horizon }),
  );
  if (!out.ok) {
    const note =
      out.reason === "offline"
        ? "The assistant is offline: no AI provider is configured. Your question is saved; you can write a draft yourself below."
        : "The assistant is unavailable right now. Your question is saved; you can write a draft yourself below.";
    await brandAi.record(
      b.client,
      b.workspaceId,
      conv.data,
      prompt,
      note,
      out.reason === "offline" ? "offline" : "error",
      used,
    );
    done();
    return { message: note };
  }
  const a = out.answer;
  const meta = { ...used, assumptions: a.assumptions, gaps: a.gaps };
  await brandAi.record(
    b.client,
    b.workspaceId,
    conv.data,
    prompt,
    a.text,
    "ok",
    meta,
  );
  const kind = tasks[c.value.task].draft;
  const target = c.value.campaign_id
    ? { campaign_id: c.value.campaign_id }
    : {};
  const content =
    kind === "plan_items"
      ? {
          horizon,
          items: a.items.length ? a.items : [{ title: a.text.slice(0, 140) }],
          assumptions: a.assumptions,
          gaps: a.gaps,
        }
      : { text: a.text, assumptions: a.assumptions, gaps: a.gaps };
  if (kind !== "plan_items" || a.items.length)
    await brandAi.saveDraft(
      b.client,
      b.workspaceId,
      conv.data,
      kind,
      target,
      content,
      "ai",
    );
  done();
  return {
    ok: true,
    message:
      "Suggestion ready. Review the draft below; nothing changes until you approve it.",
  };
}
export async function manualDraft(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const conv = uuid.safeParse(t(f, "conversation"));
  const kind = t(f, "kind") as
    "plan_items" | "brief" | "invitation_message" | "strategy_note";
  const campaign = uuid.safeParse(t(f, "campaign"));
  const text = t(f, "text");
  if (
    !["plan_items", "brief", "invitation_message", "strategy_note"].includes(
      kind,
    )
  )
    return { message: "We could not do that. Please try again." };
  const b = await ctx(f);
  const content =
    kind === "plan_items"
      ? {
          horizon: [7, 30, 90].includes(Number(t(f, "horizon")))
            ? Number(t(f, "horizon"))
            : 30,
          items: text
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l.length >= 3)
            .slice(0, 12)
            .map((title) => ({ title: title.slice(0, 140) })),
        }
      : { text };
  if (kind === "plan_items" && !content.items?.length)
    return {
      errors: { text: "Write at least one step (one per line)." },
      message: "Write at least one step.",
    };
  if (kind !== "plan_items" && text.length < 10)
    return {
      errors: { text: "Write at least 10 characters." },
      message: "Write at least 10 characters.",
    };
  const r = await brandAi.saveDraft(
    b.client,
    b.workspaceId,
    conv.success ? conv.data : null,
    kind,
    campaign.success ? { campaign_id: campaign.data } : {},
    content,
    "manual",
  );
  if (!r.ok) return { message: r.message };
  done();
  return { ok: true, message: "Draft saved. Approve it when you are ready." };
}
export async function applyDraft(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const id = uuid.safeParse(t(f, "id"));
  if (!id.success)
    return { message: "We could not do that. Please try again." };
  if (f.get("confirm") !== "on")
    return {
      errors: { confirm: "Tick the box to confirm." },
      message: "Tick the box to confirm.",
    };
  const b = await ctx(f);
  const r = await brandAi.apply(b.client, b.workspaceId, id.data, true);
  if (!r.ok) return { message: r.message };
  done();
  const m = {
    plan_items: `Added ${r.value.applied_steps} step${r.value.applied_steps === 1 ? "" : "s"} to your plan.`,
    brief:
      "Saved to the campaign's draft brief. The live campaign changes only when you publish.",
    invitation_message:
      "Marked as ready. Copy it into an invitation; the assistant never sends messages.",
    strategy_note: "Pinned as a strategy note.",
  }[r.value.kind];
  return { ok: true, message: m };
}
export async function discardDraft(f: FormData) {
  const id = uuid.safeParse(t(f, "id"));
  const b = await ctx(f);
  if (id.success) await brandAi.discard(b.client, b.workspaceId, id.data);
  done();
  const back = t(f, "back");
  redirect(
    /^\/brand\/assistant(\/[0-9a-f-]{36})?$/.test(back)
      ? `${back}?w=${b.workspaceId}`
      : `/brand/assistant?w=${b.workspaceId}`,
  );
}
export async function saveSettings(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const b = await ctx(f);
  const sources = f.getAll("sources").map(String);
  const remove = t(f, "delete") === "1";
  const r = await brandAi.settings(
    b.client,
    b.workspaceId,
    remove ? null : f.get("memory") === "on",
    remove ? null : t(f, "preferences") || null,
    remove,
    remove ? null : sources,
  );
  if (!r.ok) return { message: r.message };
  done();
  return { ok: true, message: remove ? "Memory deleted." : "Settings saved." };
}
export async function deleteConversation(f: FormData) {
  const id = uuid.safeParse(t(f, "id"));
  const b = await ctx(f);
  if (id.success) await brandAi.remove(b.client, b.workspaceId, id.data);
  done();
  redirect(`/brand/assistant?w=${b.workspaceId}&deleted=1`);
}
