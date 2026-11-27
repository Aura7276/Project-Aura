"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { brandContext } from "@/server/market/service";
import { studioContext } from "@/server/studio/service";
import { monitor } from "@/server/monitor/service";
import { rateLimited } from "@/server/security/rate-limit";

export type FormState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
} | null;
const uuid = z.uuid();
const t = (f: FormData, k: string) =>
  typeof f.get(k) === "string" ? String(f.get(k)).trim() : "";
const done = () => {
  revalidatePath("/brand", "layout");
  revalidatePath("/creator", "layout");
};
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
/** The signed-in side: the Brand area passes its workspace (w); Creator pages do not. The database decides what each side may do. */
async function side(f: FormData) {
  if (t(f, "w")) {
    const w = uuid.safeParse(t(f, "w"));
    const b = await brandContext(w.success ? w.data : undefined);
    return { client: b.client, ws: b.workspaceId, user: b.userId };
  }
  const c = await studioContext();
  return { client: c.client, ws: c.workspaceId, user: c.userId };
}

export async function recordResult(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const [collab, deliverable] = t(f, "target").split("|");
  if (!uuid.safeParse(collab).success || !deliverable)
    return {
      errors: { target: "Choose a published deliverable." },
      message: "Please check the highlighted fields.",
    };
  const value = Number(t(f, "value"));
  const errors: Record<string, string> = {};
  if (!t(f, "value") || !Number.isFinite(value) || value < 0)
    errors.value = "Enter a number of 0 or more.";
  if (t(f, "observed_on") && !isDate(t(f, "observed_on")))
    errors.observed_on = "Choose a date.";
  const windowed = t(f, "window_kind") === "window";
  if (
    windowed &&
    (!isDate(t(f, "period_start")) || !isDate(t(f, "period_end")))
  )
    errors.period_start = "A time window needs a start and an end date.";
  if (Object.keys(errors).length)
    return { errors, message: "Please check the highlighted fields." };
  const s = await side(f);
  if (rateLimited("monitor:" + s.user, 240))
    return {
      message: "You are going a little fast. Please try again in a moment.",
    };
  const r = await monitor.record(s.client, s.ws, collab, deliverable, {
    metric: t(f, "metric"),
    value,
    window_kind: windowed ? "window" : "lifetime",
    period_start: windowed ? t(f, "period_start") : null,
    period_end: windowed ? t(f, "period_end") : null,
    observed_on: t(f, "observed_on") || null,
    source: t(f, "source"),
    source_note: t(f, "source_note") || null,
  });
  if (!r.ok) return { message: r.message };
  done();
  return {
    ok: true,
    message: "Recorded with its source, date and who entered it.",
  };
}
export async function voidResult(f: FormData) {
  const id = uuid.safeParse(t(f, "id"));
  const s = await side(f);
  if (id.success)
    await monitor.void(
      s.client,
      s.ws,
      id.data,
      t(f, "reason") || "Entered by mistake",
    );
  done();
  const back = t(f, "back");
  redirect(
    /^\/(brand|creator)\/[a-z0-9/_-]+(\?[a-z0-9=&_-]*)?$/i.test(back)
      ? back
      : "/",
  );
}
export async function setSharing(f: FormData) {
  const collab = uuid.safeParse(t(f, "collab"));
  const c = await studioContext();
  if (collab.success)
    await monitor.consent(
      c.client,
      c.workspaceId,
      collab.data,
      t(f, "share") === "yes",
    );
  done();
  redirect(
    `/creator/negotiations/${collab.success ? collab.data : ""}?sharing=1#results`,
  );
}
export async function createReport(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const campaign = uuid.safeParse(t(f, "campaign"));
  if (!campaign.success)
    return { message: "We could not do that. Please try again." };
  const name = t(f, "name");
  const sections = f
    .getAll("sections")
    .map(String)
    .filter((x) =>
      ["delivery", "performance", "payments", "exceptions"].includes(x),
    );
  const errors: Record<string, string> = {};
  if (name.length < 3 || name.length > 100)
    errors.name = "Name the report (3 to 100 characters).";
  if (!sections.length) errors.sections = "Choose at least one section.";
  const from = t(f, "from"),
    to = t(f, "to");
  if (
    (from && !isDate(from)) ||
    (to && !isDate(to)) ||
    (from && to && to < from)
  )
    errors.to = "Check the period: the end cannot be before the start.";
  if (Object.keys(errors).length)
    return {
      errors,
      message: errors.sections ?? "Please check the highlighted fields.",
    };
  const s = await side(f);
  const r = await monitor.createReport(
    s.client,
    s.ws,
    campaign.data,
    name,
    sections,
    from || null,
    to || null,
  );
  if (!r.ok) return { message: r.message };
  done();
  redirect(
    `/brand/campaigns/${campaign.data}/reports/${r.value.id}?w=${s.ws}&created=1`,
  );
}
