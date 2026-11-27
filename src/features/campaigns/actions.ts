"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { brandContext } from "@/server/market/service";
import { campaigns } from "@/server/campaigns/service";
import { rateLimited } from "@/server/security/rate-limit";
import { saveCampaign, publishCampaign } from "@/features/marketplace/actions";
import { steps, type StepKey } from "./rules";

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
  const b = await brandContext(w.success ? w.data : undefined);
  return { ...b, limited: rateLimited("brand-m17:" + b.userId, 240) };
}
const nextStep = (s: string): StepKey => {
  const i = steps.findIndex((x) => x.key === s);
  return steps[Math.min(i + 1, steps.length - 1)].key;
};
const builder = (id: string, w: string, step: StepKey, q = "") =>
  `/brand/campaigns/${id}/build?step=${step}&w=${w}${q}`;

/** Steps 2 to 5 save through the M10 editor action (same validation and versioning), then continue to the next step. */
export async function saveStep(
  prev: FormState,
  f: FormData,
): Promise<FormState> {
  const id = uuid.safeParse(t(f, "id"));
  const step = t(f, "step");
  if (!id.success)
    return { message: "We could not do that. Please try again." };
  const r = await saveCampaign(prev, f);
  if (!r?.ok) return r;
  redirect(
    builder(
      id.data,
      t(f, "w"),
      t(f, "intent") === "stay" ? (step as StepKey) : nextStep(step),
      "&saved=1",
    ),
  );
}
/** Step 1 saves the private plan. */
export async function savePlan(_p: FormState, f: FormData): Promise<FormState> {
  const id = uuid.safeParse(t(f, "id"));
  if (!id.success)
    return { message: "We could not do that. Please try again." };
  const target = t(f, "kpi_target");
  if (target && !(Number(target) > 0))
    return {
      errors: { kpi_target: "A number above 0." },
      message: "Please check the highlighted fields.",
    };
  const milestones = t(f, "milestones")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = /^(\d{4}-\d{2}-\d{2})\s+(.+)$/.exec(l);
      return m
        ? { label: m[2].replace(/^[-–:]\s*/, ""), due_on: m[1] }
        : { label: l, due_on: null };
    });
  if (
    milestones.some((m) => m.label.length < 2 || m.label.length > 80) ||
    milestones.length > 12
  )
    return {
      errors: {
        milestones:
          "One milestone per line, 2 to 80 characters each, at most 12.",
      },
      message: "Please check the highlighted fields.",
    };
  const b = await ctx(f);
  if (b.limited)
    return {
      message: "You are going a little fast. Please try again in a moment.",
    };
  const r = await campaigns.savePlan(b.client, b.workspaceId, id.data, {
    objective: t(f, "objective") || null,
    kpi_metric: t(f, "kpi_metric") || null,
    kpi_target: target || null,
    segment_ids: f.getAll("segment_ids").map(String),
    product_ids: f.getAll("product_ids").map(String),
    owner_user: t(f, "owner_user") || null,
    notes: t(f, "notes") || null,
    milestones,
  });
  if (!r.ok) return { message: r.message };
  done();
  if (t(f, "intent") === "stay") return { ok: true, message: "Plan saved." };
  redirect(builder(id.data, b.workspaceId, "brief", "&saved=1"));
}
export async function toggleMilestone(f: FormData) {
  const id = uuid.safeParse(t(f, "id"));
  const b = await ctx(f);
  if (id.success) {
    const p = await campaigns.plan(b.client, b.workspaceId, id.data);
    if (p.ok && p.value.plan) {
      const i = Number(t(f, "index"));
      const ms = p.value.plan.milestones.map((m, k) =>
        k === i ? { ...m, done: !m.done } : m,
      );
      await campaigns.savePlan(b.client, b.workspaceId, id.data, {
        ...p.value.plan,
        milestones: ms,
      });
    }
  }
  done();
  redirect(`/brand/campaigns?w=${b.workspaceId}`);
}
export async function publishFromBuilder(f: FormData) {
  await publishCampaign(f); // redirects to the campaign page with the outcome (published, sent to review, or why not)
}
export async function duplicate(f: FormData) {
  const id = uuid.safeParse(t(f, "id"));
  const request = uuid.safeParse(t(f, "request"));
  const b = await ctx(f);
  let to = `/brand/campaigns?w=${b.workspaceId}&notice=generic`;
  if (id.success && request.success) {
    const r = await campaigns.duplicate(
      b.client,
      b.workspaceId,
      id.data,
      request.data,
    );
    if (r.ok) to = builder(r.value.id, b.workspaceId, "brief", "&copied=1");
  }
  done();
  redirect(to);
}
export async function duplicateForm(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const id = uuid.safeParse(t(f, "id"));
  const request = uuid.safeParse(t(f, "request"));
  if (!id.success || !request.success)
    return { message: "We could not copy it. Please try again." };
  const b = await ctx(f);
  const r = await campaigns.duplicate(
    b.client,
    b.workspaceId,
    id.data,
    request.data,
  );
  if (!r.ok) return { message: r.message };
  done();
  redirect(builder(r.value.id, b.workspaceId, "brief", "&copied=1"));
}
export async function archive(f: FormData) {
  const id = uuid.safeParse(t(f, "id"));
  const b = await ctx(f);
  let q = "";
  if (id.success) {
    const r = await campaigns.archive(
      b.client,
      b.workspaceId,
      id.data,
      t(f, "on") !== "no",
    );
    if (!r.ok) q = "&notice=archive";
  }
  done();
  redirect(`/brand/campaigns?w=${b.workspaceId}${q}`);
}
