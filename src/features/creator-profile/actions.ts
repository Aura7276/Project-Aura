"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { studioContext } from "@/server/studio/service";
import { eligible } from "@/server/auth/session";
import { profileApi, reasonText } from "@/server/profile/service";
import { rateLimited } from "@/server/security/rate-limit";
import {
  appearanceSchema,
  availabilitySchema,
  experienceSchema,
  fieldErrors,
  itemSchema,
  kitSchema,
  packageSchema,
  profileSchema,
  serviceSchema,
  shareSchema,
  testimonialSchema,
  type FieldErrors,
} from "./schemas";

export type FormState = {
  ok?: boolean;
  message?: string;
  errors?: FieldErrors;
  link?: string;
  id?: string;
} | null;
const slow = "You are going a little fast. Please wait a moment and try again.";
const uuid = z.uuid();
const t = (f: FormData, k: string) =>
  typeof f.get(k) === "string" ? String(f.get(k)) : "";
const on = (f: FormData, k: string) => f.get(k) === "on";
async function ctx(limit = 120) {
  const c = await studioContext();
  return { ...c, limited: rateLimited("profile:" + c.userId, limit) };
}
const done = () => {
  revalidatePath("/creator", "layout");
  revalidatePath("/kit", "layout");
};
const check = "Please check the highlighted fields.";
const idOf = (f: FormData) => {
  const r = uuid.safeParse(t(f, "id"));
  return r.success ? r.data : null;
};
async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("127.0.0.1") || host.startsWith("localhost")
      ? "http"
      : "https");
  return `${proto}://${host}`;
}

export async function saveProfile(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const p = profileSchema.safeParse({
    username: t(f, "username"),
    headline: t(f, "headline"),
    about: t(f, "about"),
  });
  if (!p.success) return { errors: fieldErrors(p.error), message: check };
  const c = await ctx();
  if (c.limited) return { message: slow };
  const patch: Record<string, unknown> = {
    headline: p.data.headline,
    about: p.data.about,
  };
  if (p.data.username) patch.username = p.data.username;
  const r = await profileApi.save(c.client, c.workspaceId, patch);
  if (!r.ok)
    return {
      errors: ["taken", "reserved", "format", "rate"].includes(r.reason)
        ? { username: reasonText[r.reason] }
        : {},
      message: reasonText[r.reason],
    };
  done();
  return { ok: true, message: "Saved." };
}
export async function saveAppearance(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const order = t(f, "section_order").split(",").filter(Boolean);
  const p = appearanceSchema.safeParse({
    theme: t(f, "theme"),
    cover: t(f, "cover"),
    show_branding: on(f, "show_branding"),
    section_order: order,
  });
  if (!p.success) return { errors: fieldErrors(p.error), message: check };
  const c = await ctx();
  if (c.limited) return { message: slow };
  const r = await profileApi.save(c.client, c.workspaceId, p.data);
  if (!r.ok) return { message: reasonText[r.reason] };
  done();
  return { ok: true, message: "Appearance saved." };
}
export async function saveAvailability(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const p = availabilitySchema.safeParse({
    availability: t(f, "availability"),
    available_from: t(f, "available_from"),
    available_until: t(f, "available_until"),
    availability_note: t(f, "availability_note"),
  });
  if (!p.success) return { errors: fieldErrors(p.error), message: check };
  const c = await ctx();
  if (c.limited) return { message: slow };
  const r = await profileApi.save(c.client, c.workspaceId, p.data);
  if (!r.ok) return { message: reasonText[r.reason] };
  done();
  return { ok: true, message: "Availability saved." };
}
export async function savePrivacy(f: FormData) {
  const c = await ctx();
  if (!c.limited)
    await profileApi.save(c.client, c.workspaceId, {
      show_follower_counts: on(f, "show_follower_counts"),
    });
  done();
  redirect("/creator/profile/privacy?updated=1");
}
export async function publishProfile(f: FormData) {
  const publish = t(f, "publish") === "yes";
  const listed = on(f, "listed");
  const c = await ctx(30);
  let q = "updated=1";
  if (!c.limited) {
    const r = await profileApi.publish(
      c.client,
      c.workspaceId,
      publish,
      listed,
    );
    if (!r.ok) q = "notice=" + r.reason;
  }
  done();
  redirect(`/creator/profile?${q}`);
}
const itemFields = (f: FormData) => ({
  kind: t(f, "kind"),
  title: t(f, "title"),
  description: t(f, "description"),
  link: t(f, "link"),
  content_ref: t(f, "content_ref"),
  brand_name: t(f, "brand_name"),
  year: t(f, "year"),
  objective: t(f, "objective"),
  approach: t(f, "approach"),
  contribution: t(f, "contribution"),
  deliverables: t(f, "deliverables"),
  outcomes: t(f, "outcomes"),
  show_metrics: on(f, "show_metrics"),
  visibility: t(f, "visibility") || "private",
  featured: on(f, "featured"),
});
export async function saveItem(_p: FormState, f: FormData): Promise<FormState> {
  const p = itemSchema.safeParse(itemFields(f));
  const id = idOf(f);
  const request = uuid.safeParse(t(f, "request"));
  if (!p.success) return { errors: fieldErrors(p.error), message: check };
  const c = await ctx();
  if (c.limited) return { message: slow };
  const d = p.data;
  const item = {
    ...d,
    outcomes: d.outcomes.map((s) => ({
      statement: s.slice(0, 200),
      source: "self_reported",
    })),
    content_ref: d.content_ref || null,
    year: d.year ?? null,
  };
  const r = await profileApi.saveItem(
    c.client,
    c.workspaceId,
    id ? null : request.success ? request.data : null,
    id,
    item,
  );
  if (!r.ok) return { message: reasonText[r.reason] };
  done();
  if (!id) redirect(`/creator/portfolio/${r.value.id}?created=1`);
  return { ok: true, message: "Saved." };
}
async function simpleSave(
  f: FormData,
  run: (
    c: Awaited<ReturnType<typeof ctx>>,
    id: string | null,
  ) => Promise<{ ok: boolean; reason?: keyof typeof reasonText }>,
): Promise<FormState> {
  const c = await ctx();
  if (c.limited) return { message: slow };
  const r = await run(c, idOf(f));
  if (!r.ok) return { message: reasonText[r.reason ?? "generic"] };
  done();
  return { ok: true, message: "Saved." };
}
export async function saveService(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const p = serviceSchema.safeParse({
    kind: t(f, "kind"),
    name: t(f, "name"),
    description: t(f, "description"),
    deliverables: t(f, "deliverables"),
    pricing: t(f, "pricing"),
    currency: t(f, "currency") || "INR",
    price_min: t(f, "price_min"),
    price_max: t(f, "price_max"),
    visibility: t(f, "visibility") || "private",
    rates_visibility: t(f, "rates_visibility") || "private",
  });
  if (!p.success) return { errors: fieldErrors(p.error), message: check };
  const d = {
    ...p.data,
    price_min: p.data.pricing === "quote" ? null : (p.data.price_min ?? null),
    price_max: p.data.pricing === "range" ? (p.data.price_max ?? null) : null,
  };
  return simpleSave(f, (c, id) =>
    profileApi.saveService(c.client, c.workspaceId, id, d),
  );
}
export async function savePackage(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const p = packageSchema.safeParse({
    service_kind: t(f, "service_kind") || "influencer",
    name: t(f, "name"),
    description: t(f, "description"),
    deliverables: t(f, "deliverables"),
    currency: t(f, "currency") || "INR",
    price_min: t(f, "price_min"),
    price_max: t(f, "price_max"),
    turnaround_days: t(f, "turnaround_days"),
    revisions: t(f, "revisions"),
    usage_rights: t(f, "usage_rights"),
    terms: t(f, "terms"),
    visibility: t(f, "visibility") || "private",
  });
  if (!p.success) return { errors: fieldErrors(p.error), message: check };
  // each deliverable line may start with a quantity: "3 x Reel" or "3 Reels"
  const deliverables = p.data.deliverables.map((line) => {
    const m = /^(\d{1,3})\s*(?:x|×)?\s+(.+)$/i.exec(line);
    return m
      ? {
          item: m[2].slice(0, 80),
          quantity: Math.min(100, Math.max(1, Number(m[1]))),
        }
      : { item: line.slice(0, 80), quantity: 1 };
  });
  const d = {
    ...p.data,
    deliverables,
    price_min: p.data.price_min ?? null,
    price_max: p.data.price_max ?? null,
    turnaround_days: p.data.turnaround_days ?? null,
    revisions: p.data.revisions ?? null,
  };
  return simpleSave(f, (c, id) =>
    profileApi.savePackage(c.client, c.workspaceId, id, d),
  );
}
export async function saveExperience(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const p = experienceSchema.safeParse({
    organisation: t(f, "organisation"),
    role: t(f, "role"),
    year_from: t(f, "year_from"),
    year_to: t(f, "year_to"),
    description: t(f, "description"),
    evidence_url: t(f, "evidence_url"),
    visibility: t(f, "visibility") || "private",
  });
  if (!p.success) return { errors: fieldErrors(p.error), message: check };
  const d = {
    ...p.data,
    year_from: p.data.year_from ?? null,
    year_to: p.data.year_to ?? null,
  };
  return simpleSave(f, (c, id) =>
    profileApi.saveExperience(c.client, c.workspaceId, id, d),
  );
}
const backs: Record<string, string> = {
  portfolio: "/creator/portfolio",
  service: "/creator/services",
  package: "/creator/rates/packages",
  experience: "/creator/profile/experience",
  kit: "/creator/media-kit",
};
export async function deleteRecord(f: FormData) {
  const kind = t(f, "kind");
  const id = idOf(f);
  const c = await ctx();
  if (id && kind in backs && !c.limited)
    await profileApi.remove(c.client, c.workspaceId, kind, id);
  done();
  redirect(`${backs[kind] ?? "/creator/profile"}?deleted=1`);
}
export async function createInvite(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const c = await ctx(20);
  if (c.limited) return { message: slow };
  const r = await profileApi.createInvite(
    c.client,
    c.workspaceId,
    t(f, "label").slice(0, 100),
  );
  if (!r.ok) return { message: reasonText[r.reason] };
  done();
  return {
    ok: true,
    message: "Invitation created. Copy the link now: it is shown only once.",
    link: `${await origin()}/feedback/${r.value.token}`,
  };
}
export async function revokeInvite(f: FormData) {
  const id = idOf(f);
  const c = await ctx();
  if (id && !c.limited)
    await profileApi.revokeInvite(c.client, c.workspaceId, id);
  done();
  redirect("/creator/profile/reviews?updated=1");
}
export async function testimonialAction(f: FormData) {
  const id = idOf(f);
  const action = t(f, "action");
  const c = await ctx();
  let q = "updated=1";
  if (id && ["show", "hide", "dispute"].includes(action) && !c.limited) {
    const r = await profileApi.testimonialAction(
      c.client,
      c.workspaceId,
      id,
      action,
      t(f, "reason") || null,
    );
    if (!r.ok) q = "notice=" + r.reason;
  }
  done();
  redirect(`/creator/profile/reviews?${q}`);
}
/** Submitted by the invited person (any signed-in user outside the Creator's workspace). */
export async function submitTestimonial(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const token = t(f, "token");
  if (!/^[0-9a-f]{64}$/.test(token))
    return { message: "This invitation is not valid." };
  const p = testimonialSchema.safeParse({
    author_name: t(f, "author_name"),
    author_role: t(f, "author_role"),
    relationship: t(f, "relationship"),
    body: t(f, "body"),
  });
  if (!p.success) return { errors: fieldErrors(p.error), message: check };
  const { client, user } = await eligible();
  if (rateLimited("testimonial:" + user.id, 10)) return { message: slow };
  const r = await profileApi.submitTestimonial(client, token, p.data);
  if (!r.ok)
    return {
      message:
        r.error === "denied"
          ? "This invitation is not valid, has been used, or you belong to this Creator's workspace."
          : reasonText[r.reason],
    };
  return {
    ok: true,
    message:
      "Thank you. Your testimonial will be checked by a reviewer before the Creator can choose to show it.",
  };
}
export async function moderate(f: FormData) {
  const id = idOf(f);
  const { client } = await eligible();
  let q = "decided=1";
  if (id) {
    const r = await profileApi.moderate(
      client,
      id,
      t(f, "decision"),
      t(f, "reason"),
    );
    if (!r.ok) q = "notice=1";
  }
  redirect(`/admin/profile-reviews?${q}`);
}
export async function createKit(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const p = kitSchema.safeParse({
    name: t(f, "name"),
    audience: t(f, "audience"),
    template: t(f, "template") || "editorial",
    intro: t(f, "intro"),
    contact_note: t(f, "contact_note"),
  });
  const request = uuid.safeParse(t(f, "request"));
  if (!p.success || !request.success)
    return { errors: p.success ? {} : fieldErrors(p.error), message: check };
  const c = await ctx();
  if (c.limited) return { message: slow };
  const r = await profileApi.createKit(
    c.client,
    c.workspaceId,
    request.data,
    p.data,
  );
  if (!r.ok)
    return {
      message:
        r.reason === "invalid"
          ? "You have reached the limit of 20 media kits."
          : reasonText[r.reason],
    };
  done();
  redirect(`/creator/media-kit/${r.value.id}/edit?created=1`);
}
export async function saveKit(_p: FormState, f: FormData): Promise<FormState> {
  const id = idOf(f);
  if (!id) return { message: reasonText.generic };
  const p = kitSchema.safeParse({
    name: t(f, "name"),
    audience: t(f, "audience"),
    template: t(f, "template") || "editorial",
    intro: t(f, "intro"),
    contact_note: t(f, "contact_note"),
  });
  if (!p.success) return { errors: fieldErrors(p.error), message: check };
  const keys = t(f, "section_keys").split(",").filter(Boolean);
  const sections = keys.map((key, i) => {
    const mode = t(f, `mode_${key}`);
    const picked = f
      .getAll(`items_${key}`)
      .map(String)
      .filter((x) => uuid.safeParse(x).success);
    return {
      key,
      position: i + 1,
      enabled: on(f, `enabled_${key}`),
      item_ids: mode === "chosen" ? picked : null,
    };
  });
  const c = await ctx();
  if (c.limited) return { message: slow };
  const r = await profileApi.saveKit(
    c.client,
    c.workspaceId,
    id,
    p.data,
    sections,
  );
  if (!r.ok) return { message: reasonText[r.reason] };
  done();
  return {
    ok: true,
    message:
      "Kit saved. Live links show the change straight away; snapshot links do not.",
  };
}
export async function snapshotKit(f: FormData) {
  const id = idOf(f);
  const c = await ctx(20);
  let q = "snapshot=1";
  if (id && !c.limited) {
    const r = await profileApi.snapshot(
      c.client,
      c.workspaceId,
      id,
      t(f, "note").slice(0, 200),
    );
    if (!r.ok) q = "notice=" + r.reason;
  }
  done();
  redirect(`/creator/media-kit/${id ?? ""}/history?${q}`);
}
export async function createShare(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const id = idOf(f);
  if (!id) return { message: reasonText.generic };
  const p = shareSchema.safeParse({
    kind: t(f, "kind"),
    recipient: t(f, "recipient").trim(),
    version: t(f, "version"),
    include_rates: on(f, "include_rates"),
    label: t(f, "label"),
    days: t(f, "days"),
  });
  if (!p.success) return { errors: fieldErrors(p.error), message: check };
  const c = await ctx(30);
  if (c.limited) return { message: slow };
  const d = p.data;
  const r = await profileApi.createShare(c.client, c.workspaceId, id, {
    kind: d.kind,
    recipient: d.kind === "restricted" ? d.recipient : null,
    version: d.version || null,
    include_rates: d.kind === "restricted" && d.include_rates,
    label: d.label,
    days: d.days ?? null,
  });
  if (!r.ok)
    return {
      errors:
        r.reason === "recipient" ? { recipient: reasonText.recipient } : {},
      message: reasonText[r.reason],
    };
  done();
  return {
    ok: true,
    message:
      "Link created. Copy it now: for your security it is shown only once.",
    link: `${await origin()}/kit/${r.value.token}`,
  };
}
export async function revokeShare(f: FormData) {
  const id = idOf(f);
  const kit = uuid.safeParse(t(f, "kit"));
  const c = await ctx();
  if (id && !c.limited)
    await profileApi.revokeShare(c.client, c.workspaceId, id);
  done();
  redirect(`/creator/media-kit/${kit.success ? kit.data : ""}/share?revoked=1`);
}
