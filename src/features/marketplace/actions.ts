"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { studioContext } from "@/server/studio/service";
import { eligible } from "@/server/auth/session";
import { brandContext, market, reasonText } from "@/server/market/service";
import { rateLimited } from "@/server/security/rate-limit";
import {
  campaignForm,
  fieldErrors,
  toContent,
  type FieldErrors,
} from "./schemas";

export type FormState = {
  ok?: boolean;
  message?: string;
  errors?: FieldErrors;
} | null;
const uuid = z.uuid();
const t = (f: FormData, k: string) =>
  typeof f.get(k) === "string" ? String(f.get(k)) : "";
const on = (f: FormData, k: string) => f.get(k) === "on";
const done = () => {
  revalidatePath("/creator", "layout");
  revalidatePath("/brand", "layout");
};
const safeBack = (b: string, fallback: string) =>
  /^\/creator\/marketplace(\/[a-z0-9-]+)*(\?[a-z_=0-9&-]*)?$/.test(b)
    ? b
    : fallback;
async function creator() {
  const c = await studioContext();
  return { ...c, limited: rateLimited("market:" + c.userId, 120) };
}

export async function toggleBookmark(f: FormData) {
  const id = uuid.safeParse(t(f, "id"));
  const c = await creator();
  if (id.success && !c.limited)
    await market.bookmark(
      c.client,
      c.workspaceId,
      id.data,
      t(f, "on") === "yes",
    );
  done();
  redirect(safeBack(t(f, "back"), "/creator/marketplace"));
}
export async function hide(f: FormData) {
  const kind = t(f, "kind");
  const value = t(f, "value");
  const c = await creator();
  if (["brand", "category"].includes(kind) && value && !c.limited)
    await market.hide(
      c.client,
      c.workspaceId,
      kind,
      value,
      t(f, "on") === "yes",
    );
  done();
  redirect(safeBack(t(f, "back"), "/creator/marketplace/preferences"));
}
const filterKeys = [
  "q",
  "category",
  "eligible_only",
  "money_only",
  "min_money",
  "remote_only",
  "no_exclusivity",
  "no_travel",
  "max_deliverables",
] as const;
export async function saveSearch(f: FormData) {
  const c = await creator();
  let q = "saved=1";
  const filters: Record<string, unknown> = {};
  for (const k of filterKeys) {
    const v = t(f, k);
    if (!v) continue;
    filters[k] = [
      "eligible_only",
      "money_only",
      "remote_only",
      "no_exclusivity",
      "no_travel",
    ].includes(k)
      ? v === "on" || v === "true"
      : ["min_money", "max_deliverables"].includes(k)
        ? Number(v)
        : v.slice(0, 80);
  }
  const name =
    t(f, "name").trim() || (filters.q ? `“${filters.q}”` : "My search");
  if (!c.limited) {
    const r = await market.saveSearch(
      c.client,
      c.workspaceId,
      name.slice(0, 60),
      filters,
      on(f, "alert"),
    );
    if (!r.ok) q = "notice=" + r.reason;
  }
  done();
  redirect(`/creator/marketplace/searches?${q}`);
}
export async function deleteSearch(f: FormData) {
  const id = uuid.safeParse(t(f, "id"));
  const c = await creator();
  if (id.success && !c.limited)
    await market.deleteSearch(c.client, c.workspaceId, id.data);
  done();
  redirect("/creator/marketplace/searches?deleted=1");
}
export async function setAlert(f: FormData) {
  const id = uuid.safeParse(t(f, "id"));
  const c = await creator();
  if (id.success && !c.limited)
    await market.setAlert(
      c.client,
      c.workspaceId,
      id.data,
      t(f, "on") === "yes",
    );
  done();
  redirect("/creator/marketplace/searches?updated=1");
}
export async function readAll() {
  const c = await creator();
  if (!c.limited) await market.readNotifications(c.client, c.workspaceId);
  done();
  redirect("/creator/marketplace/alerts");
}
export async function report(_p: FormState, f: FormData): Promise<FormState> {
  const id = uuid.safeParse(t(f, "id"));
  const reason = t(f, "reason");
  if (
    !id.success ||
    ![
      "fee_requested",
      "misleading_terms",
      "unsafe",
      "inappropriate",
      "spam",
      "other",
    ].includes(reason)
  )
    return {
      errors: { reason: "Choose a reason." },
      message: "Choose a reason.",
    };
  const c = await creator();
  if (c.limited) return { message: reasonText.rate };
  const r = await market.report(
    c.client,
    c.workspaceId,
    id.data,
    reason,
    t(f, "details").slice(0, 1000),
  );
  if (!r.ok)
    return {
      message:
        r.reason === "duplicate"
          ? "You have already reported this campaign. A reviewer will look at it."
          : reasonText[r.reason],
    };
  done();
  return {
    ok: true,
    message:
      "Thank you. A reviewer will look at this report. The Brand is not told who reported it.",
  };
}
export async function checkApply(f: FormData) {
  const id = uuid.safeParse(t(f, "id"));
  const c = await creator();
  if (!id.success) redirect("/creator/marketplace");
  const r = await market.checkApply(c.client, c.workspaceId, id.data);
  if (r.ok && r.value.eligible)
    redirect(`/creator/marketplace/${id.data}/apply`);
  redirect(`/creator/marketplace/${id.data}/eligibility?apply=blocked`);
}
// Brand side
const bTarget = (f: FormData) => {
  const w = uuid.safeParse(t(f, "w"));
  return w.success ? w.data : undefined;
};
export async function createCampaign(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const title = t(f, "title").trim();
  const category = t(f, "category");
  const request = uuid.safeParse(t(f, "request"));
  if (title.length < 5)
    return {
      errors: { title: "Use at least 5 characters." },
      message: "Please check the highlighted fields.",
    };
  if (!request.success) return { message: reasonText.generic };
  const b = await brandContext(bTarget(f));
  if (rateLimited("brand:" + b.userId, 60)) return { message: reasonText.rate };
  const r = await market.createCampaign(
    b.client,
    b.workspaceId,
    request.data,
    category,
    title,
  );
  if (!r.ok) return { message: reasonText[r.reason] };
  done();
  redirect(`/brand/campaigns/${r.value.id}?created=1`);
}
const formFields = (f: FormData) => ({
  category: t(f, "category"),
  visibility: t(f, "visibility"),
  show_applicant_count: on(f, "show_applicant_count"),
  title: t(f, "title"),
  summary: t(f, "summary"),
  brief: t(f, "brief"),
  deliverables: t(f, "deliverables"),
  closes_on: t(f, "closes_on"),
  starts_on: t(f, "starts_on"),
  money_type: t(f, "money_type") || "none",
  currency: t(f, "currency") || "INR",
  money_min: t(f, "money_min"),
  money_max: t(f, "money_max"),
  money_negotiable: on(f, "money_negotiable"),
  products: t(f, "products"),
  product_value: t(f, "product_value"),
  services: t(f, "services"),
  experiences: t(f, "experiences"),
  commission_pct: t(f, "commission_pct"),
  commission_terms: t(f, "commission_terms"),
  usage_months: t(f, "usage_months"),
  channels: t(f, "channels"),
  whitelisting: on(f, "whitelisting"),
  exclusivity_days: t(f, "exclusivity_days"),
  exclusivity_scope: t(f, "exclusivity_scope"),
  rights_negotiable: on(f, "rights_negotiable"),
  travel_required: on(f, "travel_required"),
  travel_covered: on(f, "travel_covered"),
  positions: t(f, "positions"),
  min_followers: t(f, "min_followers"),
  platforms: t(f, "platforms"),
  verified_ownership: on(f, "verified_ownership"),
  countries: t(f, "countries"),
  languages: t(f, "languages"),
  niches: t(f, "niches"),
  beginner_friendly: on(f, "beginner_friendly"),
  remote: on(f, "remote"),
  effort_note: t(f, "effort_note"),
});
export async function saveCampaign(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const id = uuid.safeParse(t(f, "id"));
  if (!id.success) return { message: reasonText.generic };
  const p = campaignForm.safeParse(formFields(f));
  if (!p.success)
    return {
      errors: fieldErrors(p.error),
      message: "Please check the highlighted fields.",
    };
  const b = await brandContext(bTarget(f));
  if (rateLimited("brand:" + b.userId, 120))
    return { message: reasonText.rate };
  const r = await market.saveCampaign(
    b.client,
    b.workspaceId,
    id.data,
    p.data.visibility,
    p.data.show_applicant_count,
    toContent(p.data),
  );
  if (!r.ok) return { message: reasonText[r.reason] };
  done();
  return {
    ok: true,
    message: r.value.published_version
      ? "Saved as a new draft version. The live campaign does not change until you publish the changes."
      : "Draft saved. It is private to your workspace.",
  };
}
export async function publishCampaign(f: FormData) {
  const id = uuid.safeParse(t(f, "id"));
  const b = await brandContext(bTarget(f));
  let q = "published=1";
  if (id.success) {
    const r = await market.publish(b.client, b.workspaceId, id.data);
    if (!r.ok)
      q = `notice=${r.reason}${r.detail ? `&missing=${encodeURIComponent(r.detail)}` : ""}`;
    else if (r.value.status === "in_review") q = "review=1";
  }
  done();
  redirect(`/brand/campaigns/${id.success ? id.data : ""}?${q}`);
}
export async function setCampaignStatus(f: FormData) {
  const id = uuid.safeParse(t(f, "id"));
  const action = t(f, "action");
  const b = await brandContext(bTarget(f));
  let q = "updated=1";
  if (id.success && ["pause", "resume", "close"].includes(action)) {
    const r = await market.setStatus(b.client, b.workspaceId, id.data, action);
    if (!r.ok) q = "notice=" + r.reason;
  }
  done();
  redirect(`/brand/campaigns/${id.success ? id.data : ""}?${q}`);
}
// Invitations moved to M11 (src/features/applications/actions.ts): message, eligibility, expiry and blocking.
// Reviewer
export async function review(f: FormData) {
  const { client } = await eligible();
  const kind = t(f, "kind");
  const id = uuid.safeParse(t(f, "id"));
  const decision = t(f, "decision");
  const reason = t(f, "reason");
  let q = "decided=1";
  if (id.success) {
    const r =
      kind === "brand"
        ? await market.verifyBrand(client, id.data, decision, reason)
        : kind === "report"
          ? await market.decideReport(client, id.data, decision, reason)
          : await market.moderate(client, id.data, decision, reason);
    if (!r.ok) q = "notice=1";
  }
  redirect(`/admin/marketplace?${q}`);
}
