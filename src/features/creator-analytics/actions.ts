"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { studioContext } from "@/server/studio/service";
import { analytics, reasonText } from "@/server/analytics/service";
import { rateLimited } from "@/server/security/rate-limit";
import { zonedInstant } from "./periods";
import {
  audienceSchema,
  experimentSchema,
  fieldErrors,
  finishSchema,
  grantSchema,
  tagSchema,
  timingSchema,
  type FieldErrors,
} from "./schemas";

export type FormState = {
  ok?: boolean;
  message?: string;
  errors?: FieldErrors;
} | null;
const slow = "You are going a little fast. Please wait a moment and try again.";
const uuid = z.uuid();
const t = (f: FormData, k: string) =>
  typeof f.get(k) === "string" ? String(f.get(k)) : "";
async function ctx(limit = 120) {
  const c = await studioContext();
  return { ...c, limited: rateLimited("analytics:" + c.userId, limit) };
}
const done = () => revalidatePath("/creator", "layout");
const safeBack = (b: string, fallback: string) =>
  /^\/creator\/(analytics|experiments)(\/[a-z0-9-]*)*$/.test(b) ? b : fallback;

export async function setTag(form: FormData) {
  const p = tagSchema.safeParse({
    content: t(form, "content"),
    kind: t(form, "kind"),
    value: t(form, "value"),
  });
  const c = await ctx();
  if (p.success && !c.limited)
    await analytics.setTag(
      c.client,
      c.workspaceId,
      p.data.content,
      p.data.kind,
      p.data.value,
    );
  done();
  redirect(
    safeBack(t(form, "back"), "/creator/analytics/content") +
      (p.success ? "" : "?notice=invalid"),
  );
}
export async function removeTag(form: FormData) {
  const id = uuid.safeParse(form.get("tag"));
  const c = await ctx();
  if (id.success && !c.limited)
    await analytics.removeTag(c.client, c.workspaceId, id.data);
  done();
  redirect(safeBack(t(form, "back"), "/creator/analytics/content"));
}
export async function reviewTag(form: FormData) {
  const id = uuid.safeParse(form.get("tag"));
  const action = t(form, "action") === "confirm" ? "confirm" : "reject";
  const c = await ctx();
  if (id.success && !c.limited)
    await analytics.reviewTag(
      c.client,
      c.workspaceId,
      id.data,
      action,
      t(form, "value") || null,
    );
  done();
  redirect(safeBack(t(form, "back"), "/creator/analytics/content"));
}
export async function setTiming(form: FormData) {
  const p = timingSchema.safeParse({
    content: t(form, "content"),
    date: t(form, "date"),
    time: t(form, "time"),
    tz: t(form, "tz"),
  });
  const c = await ctx();
  let notice = "";
  if (p.success && !c.limited) {
    // The Creator enters local wall-clock time in their zone; convert to an instant using that zone.
    const at = zonedInstant(p.data.date, p.data.time, p.data.tz);
    if (!at) notice = "?notice=invalid";
    else {
      const r = await analytics.setTiming(
        c.client,
        c.workspaceId,
        p.data.content,
        at,
        p.data.tz,
      );
      if (!r.ok) notice = "?notice=" + r.reason;
    }
  } else notice = "?notice=invalid";
  done();
  redirect(safeBack(t(form, "back"), "/creator/analytics/content") + notice);
}
export async function recordAudience(
  _p: FormState,
  form: FormData,
): Promise<FormState> {
  const buckets = [1, 2, 3, 4, 5, 6]
    .map((i) => ({
      bucket: t(form, `b${i}`).trim(),
      share: t(form, `s${i}`).trim(),
    }))
    .filter((b) => b.bucket || b.share);
  const p = audienceSchema.safeParse({
    account: t(form, "account"),
    dimension: t(form, "dimension"),
    observed_on: t(form, "observed_on"),
    denominator_kind: t(form, "denominator_kind") || "unknown",
    denominator: t(form, "denominator"),
    coverage: t(form, "coverage"),
    note: t(form, "note"),
    buckets,
  });
  const request = uuid.safeParse(form.get("request"));
  if (!p.success || !request.success)
    return {
      errors: p.success ? {} : fieldErrors(p.error),
      message: "Please check the highlighted fields.",
    };
  const c = await ctx();
  if (c.limited) return { message: slow };
  const d = p.data;
  const r = await analytics.recordAudience(c.client, c.workspaceId, {
    request: request.data,
    account: d.account,
    dimension: d.dimension,
    buckets: d.buckets,
    observed_on: d.observed_on,
    period_start: null,
    period_end: null,
    denominator_kind: d.denominator_kind,
    denominator: d.denominator ?? null,
    coverage: d.coverage ?? null,
    note: d.note ?? null,
  });
  if (!r.ok) return { message: reasonText[r.reason] };
  done();
  return {
    ok: true,
    message:
      "Recorded as self-reported audience information. It is private to you unless you share it.",
  };
}
export async function grantAudience(
  _p: FormState,
  form: FormData,
): Promise<FormState> {
  const p = grantSchema.safeParse({
    account: t(form, "account"),
    recipient: t(form, "recipient"),
    dimensions: form.getAll("dimensions").map(String),
    purpose: t(form, "purpose"),
    days: t(form, "days"),
  });
  if (!p.success)
    return {
      errors: fieldErrors(p.error),
      message: "Please check the highlighted fields.",
    };
  const c = await ctx();
  if (c.limited) return { message: slow };
  const d = p.data;
  const r = await analytics.grant(c.client, c.workspaceId, {
    account: d.account,
    recipient: d.recipient,
    dimensions: d.dimensions,
    purpose: d.purpose,
    valid_until: d.days
      ? new Date(Date.now() + d.days * 86_400_000).toISOString()
      : null,
  });
  if (!r.ok)
    return {
      message:
        r.error === "invalid"
          ? "That recipient cannot receive this. It must be an open Brand workspace."
          : reasonText[r.reason],
    };
  done();
  return {
    ok: true,
    message:
      "Shared with that Brand for the stated purpose only. You can revoke it any time.",
  };
}
export async function revokeAudience(form: FormData) {
  const g = uuid.safeParse(form.get("grant"));
  const c = await ctx();
  if (g.success && !c.limited)
    await analytics.revokeGrant(c.client, c.workspaceId, g.data);
  done();
  redirect("/creator/analytics/audience?updated=1");
}
export async function setCohort(form: FormData) {
  const c = await ctx();
  if (!c.limited)
    await analytics.cohortOptin(
      c.client,
      c.workspaceId,
      t(form, "enabled") === "on",
    );
  done();
  redirect("/creator/analytics/audience?updated=1");
}
export async function insightStatus(form: FormData) {
  const id = uuid.safeParse(form.get("insight"));
  const s = t(form, "status");
  const c = await ctx();
  if (
    id.success &&
    ["viewed", "saved", "dismissed", "acted"].includes(s) &&
    !c.limited
  )
    await analytics.insightStatus(c.client, c.workspaceId, id.data, s);
  done();
  redirect(safeBack(t(form, "back"), "/creator/analytics/insights"));
}
export async function refreshInsights() {
  done();
  redirect("/creator/analytics/insights?refreshed=1");
}

const expFields = (f: FormData) => ({
  account: t(f, "account"),
  name: t(f, "name"),
  hypothesis: t(f, "hypothesis"),
  objective: t(f, "objective"),
  metric: t(f, "metric"),
  planned_change: t(f, "planned_change"),
  measurement_method: t(f, "measurement_method"),
  success_criterion: t(f, "success_criterion"),
  confounders: t(f, "confounders"),
  evaluation_days: t(f, "evaluation_days"),
  baseline_refs: f.getAll("baseline_refs").map(String),
  baseline_unavailable_reason: t(f, "baseline_unavailable_reason"),
  template_key: t(f, "template_key"),
  source_insight: t(f, "source_insight"),
});
export async function createExperiment(
  _p: FormState,
  form: FormData,
): Promise<FormState> {
  const p = experimentSchema.safeParse(expFields(form));
  const request = uuid.safeParse(form.get("request"));
  if (!p.success || !request.success)
    return {
      errors: p.success ? {} : fieldErrors(p.error),
      message: "Please check the highlighted fields.",
    };
  const c = await ctx();
  if (c.limited) return { message: slow };
  const { account, ...rest } = p.data;
  const r = await analytics.createExperiment(
    c.client,
    c.workspaceId,
    request.data,
    account,
    rest,
  );
  if (!r.ok) return { message: reasonText[r.reason] };
  done();
  redirect(`/creator/experiments/${r.value.id}`);
}
async function step(
  form: FormData,
  run: (
    c: Awaited<ReturnType<typeof ctx>>,
    id: string,
  ) => Promise<{ ok: boolean; reason?: keyof typeof reasonText }>,
) {
  const id = uuid.safeParse(form.get("id"));
  const c = await ctx();
  let notice = "updated=1";
  if (id.success && !c.limited) {
    const r = await run(c, id.data);
    if (!r.ok) notice = "notice=" + (r.reason ?? "generic");
  } else notice = "notice=generic";
  done();
  redirect(`/creator/experiments/${id.success ? id.data : ""}?${notice}`);
}
export async function planExperiment(form: FormData) {
  await step(form, (c, id) =>
    analytics.planExperiment(c.client, c.workspaceId, id),
  );
}
export async function activateExperiment(form: FormData) {
  await step(form, (c, id) =>
    analytics.activateExperiment(c.client, c.workspaceId, id),
  );
}
export async function cancelExperiment(form: FormData) {
  await step(form, (c, id) =>
    analytics.finish(c.client, c.workspaceId, id, "cancel"),
  );
}
export async function linkObservation(form: FormData) {
  const ref = uuid.safeParse(form.get("ref"));
  await step(form, (c, id) =>
    ref.success
      ? analytics.link(c.client, c.workspaceId, id, ref.data)
      : Promise.resolve({ ok: false, reason: "invalid" as const }),
  );
}
export async function unlinkObservation(form: FormData) {
  const link = uuid.safeParse(form.get("link"));
  const id = uuid.safeParse(form.get("id"));
  const c = await ctx();
  if (link.success && !c.limited)
    await analytics.unlink(c.client, c.workspaceId, link.data);
  done();
  redirect(`/creator/experiments/${id.success ? id.data : ""}?updated=1`);
}
export async function completeExperiment(form: FormData) {
  const p = finishSchema.safeParse({
    id: t(form, "id"),
    outcome: t(form, "outcome"),
    interpretation: t(form, "interpretation"),
    next: t(form, "next"),
    tags: t(form, "tags"),
  });
  const c = await ctx();
  let notice = "updated=1";
  if (p.success && !c.limited) {
    const r = await analytics.finish(
      c.client,
      c.workspaceId,
      p.data.id,
      "complete",
      {
        outcome: p.data.outcome,
        interpretation: p.data.interpretation ?? null,
        next: p.data.next ?? null,
        tags: p.data.tags,
      },
    );
    if (!r.ok) notice = "notice=" + r.reason;
  } else notice = "notice=invalid";
  done();
  redirect(`/creator/experiments/${p.success ? p.data.id : ""}?${notice}`);
}
