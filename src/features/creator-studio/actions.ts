"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { studioContext, studio } from "@/server/studio/service";
import { rateLimited } from "@/server/security/rate-limit";
import type { ServiceError } from "@/server/creator/service";
import { widgetIds } from "./types";
import {
  actionStatusSchema,
  fieldErrors,
  ideaSchema,
  observationSchema,
  prefsSchema,
  defaultPrefs,
  walkthroughSchema,
  type FieldErrors,
} from "./schemas";

export type FormState = {
  ok?: boolean;
  message?: string;
  errors?: FieldErrors;
} | null;
const messages: Record<ServiceError, string> = {
  conflict: "That changed elsewhere. Reload and try again.",
  denied: "You do not have access to this workspace.",
  incomplete: "Finish onboarding first.",
  invalid: "Some of that could not be saved. Please check it and try again.",
  failed:
    "We could not save that. Nothing was lost on this page, so please try again.",
};
const backTargets = [
  "/creator/actions",
  "/creator/dashboard",
  "/creator/progress",
] as const;
const back = (v: FormDataEntryValue | null) =>
  (backTargets as readonly string[]).includes(String(v))
    ? String(v)
    : "/creator/actions";
const slow = "You are going a little fast. Please wait a moment and try again.";

export async function setActionStatus(form: FormData) {
  const id = z.uuid().safeParse(form.get("action")),
    status = actionStatusSchema.safeParse(form.get("status"));
  const ctx = await studioContext();
  if (
    id.success &&
    status.success &&
    !rateLimited("studio-action:" + ctx.userId, 120)
  )
    await studio.setAction(ctx.client, ctx.workspaceId, id.data, status.data);
  redirect(back(form.get("back")));
}
export async function captureIdea(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const parsed = ideaSchema.safeParse({
    title: form.get("title"),
    note: form.get("note") ?? undefined,
  });
  const request = z.uuid().safeParse(form.get("request"));
  if (!parsed.success || !request.success)
    return {
      errors: parsed.success ? {} : fieldErrors(parsed.error),
      message: "Please check your idea.",
    };
  const ctx = await studioContext();
  if (rateLimited("studio-write:" + ctx.userId, 60)) return { message: slow };
  const r = await studio.capture(ctx.client, ctx.workspaceId, {
    request: request.data,
    title: parsed.data.title,
    note: parsed.data.note,
  });
  if (!r.ok) return { message: messages[r.error] };
  revalidatePath("/creator", "layout");
  return { ok: true, message: "Idea saved." };
}
export async function recordObservation(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const parsed = observationSchema.safeParse({
    goal: form.get("goal"),
    value: form.get("value"),
    observed_on: form.get("observed_on"),
    note: form.get("note") ?? undefined,
  });
  const request = z.uuid().safeParse(form.get("request"));
  if (!parsed.success || !request.success)
    return {
      errors: parsed.success ? {} : fieldErrors(parsed.error),
      message: "Please check what you entered.",
    };
  const [category, metric] = parsed.data.goal.split(":");
  const ctx = await studioContext();
  if (rateLimited("studio-write:" + ctx.userId, 60)) return { message: slow };
  const r = await studio.record(ctx.client, ctx.workspaceId, {
    request: request.data,
    category,
    metric,
    value: parsed.data.value,
    observed_on: parsed.data.observed_on,
    note: parsed.data.note,
  });
  if (!r.ok)
    return {
      message:
        r.error === "invalid"
          ? "That date or goal could not be used. Use a past or current date."
          : messages[r.error],
    };
  revalidatePath("/creator", "layout");
  return {
    ok: true,
    message: "Progress recorded. It is labelled self-reported.",
  };
}
export async function savePrefs(form: FormData) {
  const parsed = prefsSchema.safeParse({
    hidden: widgetIds.filter(
      (w) => !form.getAll("show").map(String).includes(w),
    ),
    gamification: form.get("gamification") === "on",
    digest: form.get("digest") === "on",
    timezone: form.get("timezone"),
  });
  const ctx = await studioContext();
  if (!parsed.success) redirect("/creator/settings/dashboard?error=invalid");
  const r = await studio.setPrefs(ctx.client, ctx.workspaceId, parsed.data);
  redirect(
    r.ok
      ? "/creator/settings/dashboard?saved=1"
      : "/creator/settings/dashboard?error=failed",
  );
}
export async function resetPrefs() {
  const ctx = await studioContext();
  const r = await studio.setPrefs(ctx.client, ctx.workspaceId, {
    hidden: [...defaultPrefs.hidden],
    gamification: defaultPrefs.gamification,
    digest: defaultPrefs.digest,
    timezone: defaultPrefs.timezone,
  });
  redirect(
    r.ok
      ? "/creator/settings/dashboard?reset=1"
      : "/creator/settings/dashboard?error=failed",
  );
}
/** Called by the walkthrough with a plain status. Validated and stored per workspace and user. */
export async function setWalkthrough(status: string) {
  const parsed = walkthroughSchema.safeParse(status);
  if (!parsed.success) return { ok: false };
  const ctx = await studioContext();
  if (rateLimited("studio-write:" + ctx.userId, 60)) return { ok: false };
  const r = await studio.walkthrough(ctx.client, ctx.workspaceId, parsed.data);
  return { ok: r.ok };
}
export async function replayWalkthrough() {
  await setWalkthrough("not_seen");
  redirect("/creator/dashboard?tour=1");
}
