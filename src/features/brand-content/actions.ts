"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { brandContext } from "@/server/market/service";
import { brandContent, type Stage } from "@/server/brand-content/service";
import { rateLimited } from "@/server/security/rate-limit";

export type FormState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
} | null;
const uuid = z.uuid();
const t = (f: FormData, k: string) =>
  typeof f.get(k) === "string" ? String(f.get(k)).trim() : "";
const id = (f: FormData, k: string) => {
  const r = uuid.safeParse(t(f, k));
  return r.success ? r.data : null;
};
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const isHttps = (v: string) => /^https:\/\/\S{3,}$/.test(v) && v.length <= 2048;
const done = () => revalidatePath("/brand", "layout");
async function ctx(f: FormData) {
  return brandContext(id(f, "w") ?? undefined);
}
const formats = [
  "reel",
  "short",
  "carousel",
  "story",
  "post",
  "video",
  "live",
  "article",
];
const back = (f: FormData, w: string, fallback: string) => {
  const b = t(f, "back");
  return /^\/brand\/content(\/[a-z0-9-]+)?(\?[a-z0-9=&_-]*)?$/i.test(b)
    ? `${b}${b.includes("?") ? "&" : "?"}w=${w}`
    : `${fallback}?w=${w}`;
};

export async function createIdea(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const title = t(f, "title");
  const request = id(f, "request");
  if (title.length < 3 || title.length > 140)
    return {
      errors: { title: "Use 3 to 140 characters." },
      message: "Please check the highlighted fields.",
    };
  if (!request) return { message: "We could not do that. Please try again." };
  const planned = t(f, "planned_for");
  if (planned && !isDate(planned))
    return {
      errors: { planned_for: "Choose a date." },
      message: "Please check the highlighted fields.",
    };
  const b = await ctx(f);
  if (rateLimited("brand-content:" + b.userId, 240))
    return {
      message: "You are going a little fast. Please try again in a moment.",
    };
  const r = await brandContent.create(b.client, b.workspaceId, request, {
    title,
    format: formats.includes(t(f, "format")) ? t(f, "format") : "post",
    pillar_id: id(f, "pillar_id"),
    account_id: id(f, "account_id"),
    planned_for: planned || null,
    hook: t(f, "hook") || null,
  });
  if (!r.ok) return { message: r.message };
  done();
  if (t(f, "open") === "1")
    redirect(`/brand/content/${r.value.id}?w=${b.workspaceId}`);
  return { ok: true, message: "Idea added." };
}

export async function saveItem(_p: FormState, f: FormData): Promise<FormState> {
  const item = id(f, "id");
  const expected = Number(t(f, "version"));
  if (!item || !Number.isInteger(expected))
    return { message: "We could not do that. Please try again." };
  const errors: Record<string, string> = {};
  const title = t(f, "title");
  if (title.length < 3 || title.length > 140)
    errors.title = "Use 3 to 140 characters.";
  const planned = t(f, "planned_for");
  if (planned && !isDate(planned)) errors.planned_for = "Choose a date.";
  const caption = t(f, "caption");
  if (caption.length > 2200)
    errors.caption = "Captions can be up to 2,200 characters.";
  const claims = t(f, "claims")
    .split("\n")
    .map((c) => c.trim())
    .filter(Boolean);
  if (claims.length > 12 || claims.some((c) => c.length > 200))
    errors.claims = "Up to 12 claims, one per line.";
  if (Object.keys(errors).length)
    return { errors, message: "Please check the highlighted fields." };
  const b = await ctx(f);
  const r = await brandContent.save(b.client, b.workspaceId, item, expected, {
    title,
    format: formats.includes(t(f, "format")) ? t(f, "format") : "post",
    account_id: id(f, "account_id"),
    pillar_id: id(f, "pillar_id"),
    segment_id: id(f, "segment_id"),
    product_id: id(f, "product_id"),
    hook: t(f, "hook"),
    script: t(f, "script"),
    caption,
    cta: t(f, "cta"),
    disclosure: t(f, "disclosure"),
    notes: t(f, "notes"),
    claims,
    planned_for: planned || null,
  });
  if (!r.ok) return { message: r.message };
  done();
  if (!r.value.changed) return { ok: true, message: "No changes to save." };
  return {
    ok: true,
    message: r.value.reopened
      ? `Saved as version ${r.value.version}. It changed after approval, so it is back in review.`
      : `Saved as version ${r.value.version}.`,
  };
}

export async function moveItem(f: FormData) {
  const item = id(f, "id");
  const to = t(f, "to") as Stage;
  const b = await ctx(f);
  let note = "moved";
  if (
    item &&
    [
      "idea",
      "drafting",
      "production",
      "in_review",
      "scheduled",
      "archived",
    ].includes(to)
  ) {
    const r = await brandContent.move(b.client, b.workspaceId, item, to);
    note = r.ok ? "moved" : "e:" + encodeURIComponent(r.message);
  }
  done();
  const dest = back(f, b.workspaceId, `/brand/content/${item ?? ""}`);
  redirect(
    `${dest}&${note === "moved" ? "moved=" + to : "error=" + note.slice(2)}`,
  );
}

export async function reviewItem(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const item = id(f, "id");
  const version = Number(t(f, "version"));
  const decision = t(f, "decision");
  if (
    !item ||
    !Number.isInteger(version) ||
    !["approved", "changes_requested"].includes(decision)
  )
    return { message: "Choose approve or request changes." };
  const b = await ctx(f);
  const r = await brandContent.review(
    b.client,
    b.workspaceId,
    item,
    version,
    decision as "approved" | "changes_requested",
    t(f, "note") || null,
  );
  if (!r.ok)
    return {
      message: r.message,
      errors: /claims|change/.test(r.message) ? { note: r.message } : undefined,
    };
  done();
  return {
    ok: true,
    message:
      decision === "approved"
        ? `Version ${version} approved.`
        : "Sent back to drafting with your note.",
  };
}

export async function toggleCheck(f: FormData) {
  const item = id(f, "id");
  const b = await ctx(f);
  if (item)
    await brandContent.check(
      b.client,
      b.workspaceId,
      item,
      t(f, "key"),
      t(f, "done") === "1",
    );
  done();
  redirect(`/brand/content/${item ?? ""}?w=${b.workspaceId}#publish`);
}

export async function publishItem(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const item = id(f, "id");
  const url = t(f, "url");
  const on = t(f, "published_on");
  const errors: Record<string, string> = {};
  if (!isHttps(url))
    errors.url = "Paste the full https:// link to the live post.";
  if (!isDate(on)) errors.published_on = "Choose the date it went live.";
  if (!item) return { message: "We could not do that. Please try again." };
  if (Object.keys(errors).length)
    return { errors, message: "Please check the highlighted fields." };
  const b = await ctx(f);
  const r = await brandContent.publish(b.client, b.workspaceId, item, url, on);
  if (!r.ok) return { message: r.message };
  done();
  return {
    ok: true,
    message: "Marked as published. Record results as they come in.",
  };
}

export async function savePillar(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const name = t(f, "name");
  const mix = Number(t(f, "mix") || "0");
  const errors: Record<string, string> = {};
  if (name.length < 2 || name.length > 60)
    errors.name = "Use 2 to 60 characters.";
  if (!Number.isInteger(mix) || mix < 0 || mix > 100)
    errors.mix = "A whole number from 0 to 100.";
  if (Object.keys(errors).length)
    return { errors, message: "Please check the highlighted fields." };
  const b = await ctx(f);
  const r = await brandContent.savePillar(
    b.client,
    b.workspaceId,
    id(f, "id"),
    name,
    t(f, "description") || null,
    mix,
    t(f, "archived") === "on",
  );
  if (!r.ok) return { message: r.message };
  done();
  return {
    ok: true,
    message: `Saved. Your mix adds up to ${r.value.mix_total}%.`,
  };
}

export async function repurpose(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const [collab, deliverable] = t(f, "source").split("|");
  const account = id(f, "account_id");
  const request = id(f, "request");
  const planned = t(f, "planned_for");
  if (!uuid.safeParse(collab).success || !deliverable)
    return {
      errors: { source: "Choose the Creator content." },
      message: "Choose the Creator content.",
    };
  if (!account)
    return {
      errors: { account_id: "Choose one of your accounts." },
      message: "Choose one of your accounts.",
    };
  if (planned && !isDate(planned))
    return {
      errors: { planned_for: "Choose a date." },
      message: "Please check the highlighted fields.",
    };
  if (!request) return { message: "We could not do that. Please try again." };
  const b = await ctx(f);
  const r = await brandContent.repurpose(
    b.client,
    b.workspaceId,
    request,
    collab,
    deliverable,
    account,
    planned || null,
  );
  if (!r.ok) return { message: r.message };
  done();
  redirect(`/brand/content/${r.value.id}?w=${b.workspaceId}&reused=1`);
}

export async function addAsset(_p: FormState, f: FormData): Promise<FormState> {
  const url = t(f, "url");
  const title = t(f, "title");
  const errors: Record<string, string> = {};
  if (title.length < 2 || title.length > 120)
    errors.title = "Use 2 to 120 characters.";
  if (!isHttps(url))
    errors.url = "Use a full https:// link to where the file is kept.";
  if (t(f, "provenance") === "creator" && t(f, "rights_note").length < 5)
    errors.rights_note = "Say which agreement allows it.";
  if (Object.keys(errors).length)
    return { errors, message: "Please check the highlighted fields." };
  const b = await ctx(f);
  const r = await brandContent.addAsset(
    b.client,
    b.workspaceId,
    id(f, "item"),
    {
      title,
      url,
      kind: t(f, "kind"),
      provenance: t(f, "provenance"),
      rights_note: t(f, "rights_note") || null,
    },
  );
  if (!r.ok) return { message: r.message };
  done();
  return { ok: true, message: "Asset added." };
}
export async function removeAsset(f: FormData) {
  const a = id(f, "asset");
  const b = await ctx(f);
  if (a) await brandContent.removeAsset(b.client, b.workspaceId, a);
  done();
  redirect(`/brand/content/${id(f, "item") ?? ""}?w=${b.workspaceId}#assets`);
}

export async function recordResult(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const item = id(f, "id");
  const value = Number(t(f, "value"));
  const observed = t(f, "observed_on") || new Date().toISOString().slice(0, 10);
  const errors: Record<string, string> = {};
  if (!t(f, "value") || !Number.isFinite(value) || value < 0)
    errors.value = "Enter a number of 0 or more.";
  if (!isDate(observed)) errors.observed_on = "Choose a date.";
  if (!item) return { message: "We could not do that. Please try again." };
  if (Object.keys(errors).length)
    return { errors, message: "Please check the highlighted fields." };
  const b = await ctx(f);
  const r = await brandContent.record(
    b.client,
    b.workspaceId,
    item,
    t(f, "metric"),
    value,
    observed,
    t(f, "source"),
    t(f, "note") || null,
  );
  if (!r.ok) return { message: r.message };
  done();
  return { ok: true, message: "Recorded with its source and date." };
}
export async function voidResult(f: FormData) {
  const r = id(f, "result");
  const b = await ctx(f);
  if (r)
    await brandContent.void(
      b.client,
      b.workspaceId,
      r,
      t(f, "reason") || "Entered by mistake",
    );
  done();
  redirect(`/brand/content/${id(f, "item") ?? ""}?w=${b.workspaceId}#results`);
}
