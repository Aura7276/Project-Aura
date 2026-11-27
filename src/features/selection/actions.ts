"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { brandContext } from "@/server/market/service";
import { studioContext } from "@/server/studio/service";
import { selection } from "@/server/selection/service";
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
async function brand(f: FormData) {
  const w = uuid.safeParse(t(f, "w"));
  const b = await brandContext(w.success ? w.data : undefined);
  return { ...b, limited: rateLimited("brand-m18:" + b.userId, 240) };
}
const ids = (f: FormData) =>
  f
    .getAll("ids")
    .map(String)
    .filter((x) => uuid.safeParse(x).success);

export async function holdPlace(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const id = uuid.safeParse(t(f, "id"));
  if (!id.success)
    return { message: "We could not do that. Please try again." };
  const b = await brand(f);
  if (b.limited)
    return {
      message: "You are going a little fast. Please try again in a moment.",
    };
  const r = await selection.hold(
    b.client,
    b.workspaceId,
    id.data,
    t(f, "message") || null,
  );
  if (!r.ok) return { message: r.message };
  done();
  return {
    ok: true,
    message:
      "Place held for 72 hours. The Creator was asked to accept; this is not an agreement.",
  };
}
export async function releasePlace(f: FormData) {
  const id = uuid.safeParse(t(f, "id"));
  const b = await brand(f);
  if (id.success) await selection.release(b.client, b.workspaceId, id.data);
  done();
  redirect(
    `/brand/applications/${id.success ? id.data : ""}?w=${b.workspaceId}&released=1`,
  );
}
export async function addNote(_p: FormState, f: FormData): Promise<FormState> {
  const id = uuid.safeParse(t(f, "id"));
  if (!id.success)
    return { message: "We could not do that. Please try again." };
  const tags = t(f, "tags")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 6);
  if (!t(f, "body") && !tags.length)
    return {
      errors: { body: "Write a note or add a tag." },
      message: "Write a note or add a tag.",
    };
  const b = await brand(f);
  const r = await selection.note(
    b.client,
    b.workspaceId,
    id.data,
    t(f, "body").slice(0, 1000),
    tags,
  );
  if (!r.ok) return { message: r.message };
  done();
  return { ok: true, message: "Saved. Only your team can see notes and tags." };
}
/** Bulk review from the inbox (shortlist or reject). Selection is never a bulk action. */
export async function bulk(f: FormData) {
  const campaign = uuid.safeParse(t(f, "campaign"));
  const action = t(f, "bulk_action");
  const b = await brand(f);
  let q = "&bulk=none";
  const chosen = ids(f);
  if (
    campaign.success &&
    chosen.length &&
    ["shortlist", "reject", "review"].includes(action)
  ) {
    const r = await selection.bulk(
      b.client,
      b.workspaceId,
      campaign.data,
      chosen,
      action,
      t(f, "feedback") || null,
    );
    q = r.ok
      ? `&bulk=${action}&done=${r.value.done}&skipped=${r.value.skipped}`
      : "&bulk=error";
  }
  done();
  redirect(
    `/brand/campaigns/${campaign.success ? campaign.data : ""}/applications?w=${b.workspaceId}${q}`,
  );
}
export async function compare(f: FormData) {
  const campaign = uuid.safeParse(t(f, "campaign"));
  const b = await brand(f);
  const chosen = ids(f).slice(0, 4);
  redirect(
    `/brand/campaigns/${campaign.success ? campaign.data : ""}/compare?w=${b.workspaceId}&ids=${chosen.join(",")}`,
  );
}
// ───────── Creator ─────────
export async function respond(_p: FormState, f: FormData): Promise<FormState> {
  const id = uuid.safeParse(t(f, "id"));
  const accept = t(f, "accept") === "yes";
  if (!id.success)
    return { message: "We could not do that. Please try again." };
  if (!accept && f.get("confirm") !== "on")
    return {
      errors: { confirm: "Tick the box to decline the place." },
      message: "Tick the box to decline the place.",
    };
  const c = await studioContext();
  const r = await selection.respond(c.client, c.workspaceId, id.data, accept);
  if (!r.ok) return { message: r.message };
  done();
  if (accept)
    redirect(`/creator/negotiations/${r.value.collaboration_id}?accepted=1`);
  redirect(`/creator/applications/${id.data}?withdrawn=1`);
}
