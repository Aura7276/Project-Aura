"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  creatorContext,
  loadState,
  repository,
  type ServiceError,
} from "@/server/creator/service";
import { rateLimited } from "@/server/security/rate-limit";
import { parseSection, type FieldErrors } from "./schemas";
import { allSteps, type StepId } from "./types";
import { generateInitialPlan } from "./plan";
import { canActivate, followingStep, nextStep } from "./progress";

export type ActionState = { errors?: FieldErrors; message?: string } | null;
const base = "/onboarding/creator";
const messages: Record<ServiceError, string> = {
  conflict:
    "This was changed in another tab or device. Reload to see the latest, then try again.",
  denied: "You do not have access to this workspace.",
  incomplete: "A few required answers are still missing.",
  invalid:
    "Some of the information could not be saved. Please check it and try again.",
  failed:
    "We could not save that. Nothing was lost on this page, so please try again.",
};
const stepSchema = z.enum(allSteps as [StepId, ...StepId[]]);
function parsePayload(raw: FormDataEntryValue | null): unknown {
  if (typeof raw !== "string" || raw.length > 60_000) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
export async function saveStep(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const step = stepSchema.safeParse(form.get("step"));
  const revision = z.coerce
    .number()
    .int()
    .min(0)
    .safeParse(form.get("revision"));
  const intent = String(form.get("intent") ?? "continue");
  if (!step.success || !revision.success) return { message: messages.invalid };
  const ctx = await creatorContext();
  if (rateLimited("save:" + ctx.userId, 90))
    return {
      message:
        "You are going a little fast. Please wait a moment and try again.",
    };
  const after = intent === "save_exit" ? null : followingStep(step.data);
  if (intent === "skip") {
    const r = await repository.skip(
      ctx.client,
      ctx.workspaceId,
      step.data,
      revision.data,
      after,
    );
    if (!r.ok) return { message: messages[r.error] };
    redirect(`${base}/${after}`);
  }
  const parsed = parseSection(
    step.data,
    parsePayload(form.get("payload")) ?? {},
  );
  if (!parsed.ok)
    return {
      errors: parsed.errors,
      message: "Please fix the highlighted fields.",
    };
  const r = await repository.save(
    ctx.client,
    ctx.workspaceId,
    step.data,
    parsed.data,
    revision.data,
    after,
  );
  if (!r.ok) return { message: messages[r.error] };
  redirect(
    intent === "save_exit"
      ? "/workspaces"
      : r.value.profile?.activated_at &&
          (step.data === "rates" || step.data === "resources")
        ? `${base}/profile`
        : `${base}/${after}`,
  );
}
export async function activate(form: FormData) {
  const request = z.uuid().safeParse(form.get("request"));
  const { client, workspaceId, state, userId } = await loadState();
  if (!request.success) redirect(`${base}/review?error=invalid`);
  if (rateLimited("activate:" + userId, 10))
    redirect(`${base}/review?error=rate`);
  if (state.profile?.activated_at) redirect(`${base}/complete`);
  if (!canActivate(state))
    redirect(
      `${base}/${nextStep(state) === "review" ? "identity" : nextStep(state)}?error=incomplete`,
    );
  const r = await repository.activate(
    client,
    workspaceId,
    request.data,
    generateInitialPlan(state),
  );
  if (!r.ok) redirect(`${base}/review?error=${r.error}`);
  redirect(`${base}/complete`);
}
export async function toggleAction(form: FormData) {
  const id = z.uuid().safeParse(form.get("action"));
  const { client, workspaceId, userId } = await creatorContext();
  if (id.success && !rateLimited("toggle:" + userId, 120))
    await repository.setAction(
      client,
      workspaceId,
      id.data,
      form.get("done") === "yes",
    );
  redirect(`${base}/complete`);
}
