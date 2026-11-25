"use server";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { studioContext } from "@/server/studio/service";
import { reasonText, social, type SocialResult } from "@/server/social/service";
import { rateLimited } from "@/server/security/rate-limit";
import {
  accountSchema,
  contentObservationSchema,
  correctionSchema,
  fieldErrors,
  grantSchema,
  observationSchema,
  updateSchema,
  type FieldErrors,
} from "./schemas";
import {
  checkEvidenceFile,
  evidenceBucket,
  evidencePath,
  evidenceUploadsEnabled,
  evidenceDisabledReason,
  extFor,
} from "./evidence";

export type FormState = {
  ok?: boolean;
  message?: string;
  errors?: FieldErrors;
} | null;
const slow = "You are going a little fast. Please wait a moment and try again.";
const base = "/creator/socials";
const text = (f: FormData, k: string) =>
  typeof f.get(k) === "string" ? String(f.get(k)) : "";
const flag = (f: FormData, k: string) => f.get(k) === "on";
const uuid = z.uuid();
const fail = (r: Extract<SocialResult<unknown>, { ok: false }>): FormState => ({
  message: reasonText[r.reason],
});
async function ctx(limit = 90) {
  const c = await studioContext();
  return { ...c, limited: rateLimited("social:" + c.userId, limit) };
}
const done = () => revalidatePath("/creator", "layout");
const back = (f: FormData, fallback: string) => {
  const b = text(f, "back");
  return /^\/creator\/socials(\/[0-9a-f-]{36}(\/(verify|metrics|history))?)?$/.test(
    b,
  ) || b === "/creator/socials/settings"
    ? b
    : fallback;
};

export async function addAccount(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const request = uuid.safeParse(form.get("request"));
  const parsed = accountSchema.safeParse({
    platform: text(form, "platform"),
    handle: text(form, "handle"),
    profile_url: text(form, "profile_url"),
    display_name: text(form, "display_name"),
    account_type: text(form, "account_type"),
    visibility: text(form, "visibility") || "unknown",
    ownership_scope: flag(form, "brand_page")
      ? "brand_or_company"
      : "individual",
    content_category: text(form, "content_category"),
    is_primary: flag(form, "is_primary"),
    preferred_for_platform: flag(form, "preferred"),
    followers: text(form, "followers"),
    observed_on: text(form, "observed_on"),
  });
  if (!parsed.success || !request.success)
    return {
      errors: parsed.success ? {} : fieldErrors(parsed.error),
      message: "Please check the highlighted fields.",
    };
  const c = await ctx();
  if (c.limited) return { message: slow };
  const r = await social.add(
    c.client,
    c.workspaceId,
    request.data,
    parsed.data,
  );
  if (!r.ok) return fail(r);
  done();
  redirect(`${base}/${r.value.id}`);
}
export async function updateAccount(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const id = uuid.safeParse(form.get("account"));
  const parsed = updateSchema.safeParse({
    display_name: text(form, "display_name"),
    content_category: text(form, "content_category"),
    profile_url: text(form, "profile_url"),
    handle: text(form, "handle"),
    visibility: text(form, "visibility") || undefined,
    account_type: text(form, "account_type"),
    ownership_scope: flag(form, "brand_page")
      ? "brand_or_company"
      : "individual",
  });
  if (!id.success || !parsed.success)
    return {
      errors: parsed.success ? {} : fieldErrors(parsed.error),
      message: "Please check the highlighted fields.",
    };
  const c = await ctx();
  if (c.limited) return { message: slow };
  const r = await social.update(c.client, c.workspaceId, id.data, parsed.data);
  if (!r.ok) return fail(r);
  done();
  return { ok: true, message: "Saved." };
}
async function simple(
  form: FormData,
  run: (
    c: Awaited<ReturnType<typeof ctx>>,
    id: string,
  ) => Promise<SocialResult<unknown>>,
  fallback: string,
) {
  const id = uuid.safeParse(form.get("account"));
  const c = await ctx();
  if (id.success && !c.limited) await run(c, id.data);
  done();
  redirect(back(form, fallback) + "?updated=1");
}
export async function setPrimary(form: FormData) {
  await simple(
    form,
    (c, id) => social.setPrimary(c.client, c.workspaceId, id),
    base,
  );
}
export async function setPreferred(form: FormData) {
  const on = flag(form, "on");
  await simple(
    form,
    (c, id) => social.setPreferred(c.client, c.workspaceId, id, on),
    base,
  );
}
export async function setSharing(form: FormData) {
  const v = text(form, "visibility") === "published" ? "published" : "private";
  await simple(
    form,
    (c, id) => social.setSharing(c.client, c.workspaceId, id, v),
    base,
  );
}
export async function archiveAccount(form: FormData) {
  const on = text(form, "archive") === "yes";
  await simple(
    form,
    (c, id) => social.archive(c.client, c.workspaceId, id, on),
    base,
  );
}
export async function removeAccount(form: FormData) {
  const id = uuid.safeParse(form.get("account"));
  const rep = uuid.safeParse(form.get("replacement"));
  const c = await ctx();
  if (id.success && !c.limited)
    await social.remove(
      c.client,
      c.workspaceId,
      id.data,
      rep.success ? rep.data : null,
    );
  done();
  redirect(base + "?removed=1");
}
export async function disconnectAccount(form: FormData) {
  const id = uuid.safeParse(form.get("account"));
  const c = await ctx();
  let notice = "updated=1";
  if (id.success && !c.limited) {
    const r = await social.disconnect(c.client, c.workspaceId, id.data);
    if (!r.ok) notice = "notice=" + r.reason;
  }
  done();
  redirect(`${base}/${id.success ? id.data : ""}?${notice}`);
}
export async function recordObservation(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const parsed = observationSchema.safeParse({
    account: text(form, "account"),
    metric: text(form, "metric"),
    value: text(form, "value"),
    observed_on: text(form, "observed_on"),
    period_start: text(form, "period_start"),
    period_end: text(form, "period_end"),
    note: text(form, "note"),
  });
  const request = uuid.safeParse(form.get("request"));
  if (!parsed.success || !request.success)
    return {
      errors: parsed.success ? {} : fieldErrors(parsed.error),
      message: "Please check what you entered.",
    };
  const c = await ctx();
  if (c.limited) return { message: slow };
  const d = parsed.data;
  const r = await social.record(c.client, c.workspaceId, {
    request: request.data,
    account: d.account,
    metric: d.metric,
    value: d.value,
    observed_on: d.observed_on,
    period_start: d.period_start ?? null,
    period_end: d.period_end ?? null,
    note: d.note ?? null,
  });
  if (!r.ok) return fail(r);
  done();
  return {
    ok: true,
    message:
      "Recorded. It is labelled self-reported and added to your history.",
  };
}
export async function recordContent(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const parsed = contentObservationSchema.safeParse({
    account: text(form, "account"),
    url: text(form, "url"),
    external_id: text(form, "external_id"),
    title: text(form, "title"),
    format: text(form, "format"),
    published_on: text(form, "published_on"),
    metric: text(form, "metric"),
    value: text(form, "value"),
    window: text(form, "window") || "lifetime",
    observed_on: text(form, "observed_on"),
    period_start: text(form, "period_start"),
    period_end: text(form, "period_end"),
    note: text(form, "note"),
  });
  const request = uuid.safeParse(form.get("request"));
  if (!parsed.success || !request.success)
    return {
      errors: parsed.success ? {} : fieldErrors(parsed.error),
      message: "Please check what you entered.",
    };
  const c = await ctx();
  if (c.limited) return { message: slow };
  const d = parsed.data;
  const r = await social.recordContent(c.client, c.workspaceId, {
    request: request.data,
    account: d.account,
    content: {
      url: d.url,
      external_id: d.external_id,
      title: d.title,
      format: d.format,
      published_on: d.published_on,
    },
    metric: d.metric,
    value: d.value,
    window: d.window,
    observed_on: d.observed_on,
    period_start: d.period_start ?? null,
    period_end: d.period_end ?? null,
    note: d.note ?? null,
  });
  if (!r.ok) return fail(r);
  done();
  return {
    ok: true,
    message:
      "Recorded for this content item. Earlier snapshots are kept and never added together.",
  };
}
export async function correctObservation(form: FormData) {
  const parsed = correctionSchema.safeParse({
    observation: text(form, "observation"),
    value: text(form, "value"),
    reason: text(form, "reason"),
  });
  const account = uuid.safeParse(form.get("account"));
  const c = await ctx();
  let notice = "corrected=1";
  if (parsed.success && !c.limited) {
    const r = await social.correct(
      c.client,
      c.workspaceId,
      randomUUID(),
      parsed.data.observation,
      parsed.data.value,
      parsed.data.reason,
    );
    if (!r.ok) notice = "notice=" + r.reason;
  } else notice = "notice=generic";
  done();
  redirect(`${base}/${account.success ? account.data : ""}/history?${notice}`);
}
export async function startVerification(form: FormData) {
  const id = uuid.safeParse(form.get("account"));
  const c = await ctx(20);
  let notice = "started=1";
  if (id.success && !c.limited) {
    const r = await social.startVerification(
      c.client,
      c.workspaceId,
      id.data,
      randomUUID(),
    );
    if (!r.ok) notice = "notice=" + r.reason;
  }
  done();
  redirect(`${base}/${id.success ? id.data : ""}/verify?${notice}`);
}
export async function requestReview(form: FormData) {
  const id = uuid.safeParse(form.get("account"));
  const claim = uuid.safeParse(form.get("claim"));
  const c = await ctx(20);
  let notice = "review=1";
  if (claim.success && !c.limited) {
    const r = await social.requestReview(c.client, c.workspaceId, claim.data);
    if (!r.ok) notice = "notice=" + r.reason;
  }
  done();
  redirect(`${base}/${id.success ? id.data : ""}/verify?${notice}`);
}
export async function cancelVerification(form: FormData) {
  const id = uuid.safeParse(form.get("account"));
  const claim = uuid.safeParse(form.get("claim"));
  const c = await ctx(20);
  if (claim.success && !c.limited)
    await social.cancelVerification(c.client, c.workspaceId, claim.data);
  done();
  redirect(`${base}/${id.success ? id.data : ""}/verify?cancelled=1`);
}
/** Evidence upload. Disabled unless the owner switches it on (private bucket and policies required). Files are validated, stored privately under a generated path, and stay pending until scanned. */
export async function submitEvidence(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  if (!evidenceUploadsEnabled()) return { message: evidenceDisabledReason };
  const claim = uuid.safeParse(form.get("claim"));
  const file = form.get("file");
  if (!claim.success || !(file instanceof File) || file.size === 0)
    return { message: "Choose an image to upload." };
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const check = checkEvidenceFile(
    { size: file.size, declaredMime: file.type, head },
    true,
  );
  if (!check.ok) return { message: check.reason };
  const c = await ctx(20);
  if (c.limited) return { message: slow };
  const path = evidencePath(c.workspaceId, claim.data, check.mime);
  if (!path || !extFor(check.mime))
    return { message: "That file type is not accepted." };
  const up = await (
    c.client as unknown as {
      storage: {
        from: (b: string) => {
          upload: (
            p: string,
            f: File,
            o: object,
          ) => Promise<{ error: unknown }>;
          remove: (p: string[]) => Promise<unknown>;
        };
      };
    }
  ).storage
    .from(evidenceBucket)
    .upload(path, file, { contentType: check.mime, upsert: false });
  if (up.error)
    return { message: "The upload did not complete. Nothing was saved." };
  const r = await social.submitEvidence(c.client, c.workspaceId, claim.data, {
    storage_path: path,
    mime: check.mime,
    size: file.size,
  });
  if (!r.ok) {
    await (
      c.client as unknown as {
        storage: {
          from: (b: string) => { remove: (p: string[]) => Promise<unknown> };
        };
      }
    ).storage
      .from(evidenceBucket)
      .remove([path]);
    return fail(r);
  }
  done();
  return {
    ok: true,
    message: "Uploaded privately. It will be usable once it has been scanned.",
  };
}
export async function grantShare(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const parsed = grantSchema.safeParse({
    account: text(form, "account"),
    recipient: text(form, "recipient"),
    fields: form.getAll("fields").map(String),
    purpose: text(form, "purpose"),
    valid_days: text(form, "valid_days"),
  });
  if (!parsed.success)
    return {
      errors: fieldErrors(parsed.error),
      message: "Please check the highlighted fields.",
    };
  const c = await ctx();
  if (c.limited) return { message: slow };
  const d = parsed.data;
  const r = await social.grant(c.client, c.workspaceId, {
    account: d.account,
    recipient: d.recipient,
    fields: d.fields,
    purpose: d.purpose,
    valid_until: d.valid_days
      ? new Date(Date.now() + d.valid_days * 86_400_000).toISOString()
      : null,
  });
  if (!r.ok)
    return {
      message:
        r.error === "invalid"
          ? "That recipient cannot receive this. It must be a Brand or Agency workspace."
          : reasonText[r.reason],
    };
  done();
  return {
    ok: true,
    message:
      "Shared with that workspace for the stated purpose. You can revoke it any time.",
  };
}
export async function revokeGrant(form: FormData) {
  const grant = uuid.safeParse(form.get("grant"));
  const id = uuid.safeParse(form.get("account"));
  const c = await ctx();
  if (grant.success && !c.limited)
    await social.revokeGrant(c.client, c.workspaceId, grant.data);
  done();
  redirect(`${base}/${id.success ? id.data : ""}?updated=1`);
}
export async function setReminders(form: FormData) {
  const c = await ctx();
  if (!c.limited)
    await social.setReminders(c.client, c.workspaceId, flag(form, "weekly"));
  done();
  redirect(`${base}/settings?saved=1`);
}
export async function snoozeReminder(form: FormData) {
  const id = uuid.safeParse(form.get("account"));
  const c = await ctx();
  if (id.success && !c.limited)
    await social.snooze(c.client, c.workspaceId, id.data, 7);
  done();
  redirect(`${base}?updated=1`);
}
export async function requestRefresh(form: FormData) {
  const id = uuid.safeParse(form.get("account"));
  const c = await ctx(20);
  let notice = "refresh=1";
  if (id.success && !c.limited) {
    const r = await social.requestRefresh(
      c.client,
      c.workspaceId,
      id.data,
      randomUUID(),
    );
    if (!r.ok) notice = "notice=" + r.reason;
  }
  redirect(`${base}/${id.success ? id.data : ""}?${notice}`);
}
