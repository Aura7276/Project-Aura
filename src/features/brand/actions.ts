"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { brandContext } from "@/server/market/service";
import { eligible } from "@/server/auth/session";
import { brand, reasonText } from "@/server/brand/service";
import { rateLimited } from "@/server/security/rate-limit";
import {
  buildPlan,
  evidenceFields,
  horizons,
  type BrandState,
  type EvidenceField,
  type Horizon,
} from "./rules";

export type FormState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
} | null;
const uuid = z.uuid();
const t = (f: FormData, k: string) =>
  typeof f.get(k) === "string" ? String(f.get(k)).trim() : "";
const on = (f: FormData, k: string) => f.get(k) === "on";
const lines = (f: FormData, k: string) =>
  t(f, k)
    .split(/\n|,/)
    .map((x) => x.trim())
    .filter(Boolean);
const many = (f: FormData, k: string) =>
  f.getAll(k).map(String).filter(Boolean);
const done = () => revalidatePath("/brand", "layout");
const bad = (errors: Record<string, string>): FormState => ({
  errors,
  message: "Please check the highlighted fields.",
});
async function ctx(f: FormData) {
  const w = uuid.safeParse(t(f, "w"));
  const b = await brandContext(w.success ? w.data : undefined);
  return { ...b, limited: rateLimited("brand-m14:" + b.userId, 240) };
}
const fail = (r: {
  reason: keyof typeof reasonText;
  detail?: string;
}): FormState => {
  if (r.reason === "missing" && r.detail)
    return {
      message: reasonText.missing,
      errors: Object.fromEntries(
        r.detail
          .split(",")
          .map((k) => [
            k,
            `Needed: ${evidenceFields[k as EvidenceField] ?? k}.`,
          ]),
      ),
    };
  return { message: reasonText[r.reason] };
};
const httpsOrEmpty = (v: string) => !v || /^https:\/\/\S{3,200}$/.test(v);

// ───────── Onboarding ─────────
export async function saveBasics(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const name = t(f, "public_name");
  const errors: Record<string, string> = {};
  if (name.length < 2 || name.length > 80)
    errors.public_name = "Use 2 to 80 characters.";
  if (!/^[A-Za-z]{2}$/.test(t(f, "country")))
    errors.country = "Choose a country.";
  if (!httpsOrEmpty(t(f, "website")))
    errors.website = "Use a full https:// address, or leave it empty.";
  if (Object.keys(errors).length) return bad(errors);
  const b = await ctx(f);
  if (b.limited) return { message: reasonText.rate };
  const r = await brand.saveProfile(b.client, b.workspaceId, {
    public_name: name,
    business_type: t(f, "business_type"),
    country: t(f, "country").toUpperCase(),
    website: t(f, "website") || null,
    industry: t(f, "industry") || null,
    intent: t(f, "intent"),
    onboarding_step: "objective",
  });
  if (!r.ok) return fail(r);
  done();
  redirect(`/brand/onboarding?step=objective&w=${b.workspaceId}`);
}
export async function saveObjective(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const b = await ctx(f);
  const r = await brand.saveProfile(b.client, b.workspaceId, {
    objective: t(f, "objective"),
    stage: t(f, "stage"),
    experience: t(f, "experience"),
    team_size: t(f, "team_size") || null,
    resources: many(f, "resources"),
    onboarding_step: "customers",
  });
  if (!r.ok) return fail(r);
  done();
  redirect(`/brand/onboarding?step=customers&w=${b.workspaceId}`);
}
/** Optional steps: save what was typed (if anything) and move on. */
export async function onboardingStep(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const b = await ctx(f);
  const step = t(f, "step");
  const next =
    { customers: "goals", goals: "creators", creators: "review" }[step] ??
    "review";
  if (t(f, "segment_name")) {
    const r = await brand.saveSegment(b.client, b.workspaceId, null, {
      name: t(f, "segment_name"),
      description: t(f, "segment_description") || null,
      basis: "hypothesis",
    });
    if (!r.ok) return fail(r);
  }
  if (t(f, "product_name")) {
    const r = await brand.saveProduct(b.client, b.workspaceId, null, {
      name: t(f, "product_name"),
      kind: t(f, "product_kind") || "product",
    });
    if (!r.ok) return fail(r);
  }
  if (t(f, "goal_metric")) {
    const target = Number(t(f, "goal_target"));
    if (!(target > 0)) return bad({ goal_target: "Enter a target above 0." });
    const r = await brand.saveGoal(b.client, b.workspaceId, null, {
      kind: t(f, "goal_kind"),
      metric: t(f, "goal_metric"),
      target,
      horizon_days: t(f, "goal_horizon") || "30",
    });
    if (!r.ok) return fail(r);
  }
  if (step === "creators" && (many(f, "platforms").length || t(f, "niches"))) {
    const r = await brand.savePref(b.client, b.workspaceId, {
      niches: lines(f, "niches"),
      platforms: many(f, "platforms"),
      ugc_interest: on(f, "ugc_interest"),
      experience: many(f, "experience"),
    });
    if (!r.ok) return fail(r);
  }
  await brand.saveProfile(b.client, b.workspaceId, { onboarding_step: next });
  done();
  redirect(`/brand/onboarding?step=${next}&w=${b.workspaceId}`);
}
async function regenerate(b: Awaited<ReturnType<typeof ctx>>, only?: Horizon) {
  const s = await brand.state(b.client, b.workspaceId);
  if (!s.ok) return;
  for (const h of only ? [only] : horizons)
    await brand.savePlan(
      b.client,
      b.workspaceId,
      h,
      buildPlan(s.value as BrandState, h),
    );
}
export async function finishOnboarding(f: FormData) {
  const b = await ctx(f);
  const r = await brand.complete(b.client, b.workspaceId);
  if (r.ok) await regenerate(b);
  done();
  redirect(`/brand?w=${b.workspaceId}&welcome=1`);
}

// ───────── Profile, publication ─────────
export async function saveProfile(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const errors: Record<string, string> = {};
  if (t(f, "public_name").length < 2)
    errors.public_name = "Use 2 to 80 characters.";
  if (!httpsOrEmpty(t(f, "website")))
    errors.website = "Use a full https:// address, or leave it empty.";
  if (t(f, "about").length > 1500) errors.about = "At most 1,500 characters.";
  if (Object.keys(errors).length) return bad(errors);
  const b = await ctx(f);
  if (b.limited) return { message: reasonText.rate };
  const r = await brand.saveProfile(b.client, b.workspaceId, {
    public_name: t(f, "public_name"),
    tagline: t(f, "tagline") || null,
    about: t(f, "about") || null,
    industry: t(f, "industry") || null,
    website: t(f, "website") || null,
    business_type: t(f, "business_type"),
    country: t(f, "country").toUpperCase(),
    stage: t(f, "stage"),
    experience: t(f, "experience"),
    intent: t(f, "intent"),
    objective: t(f, "objective"),
    team_size: t(f, "team_size") || null,
    resources: many(f, "resources"),
    agency_name: t(f, "agency_name") || null,
  });
  if (!r.ok) return fail(r);
  done();
  return { ok: true, message: "Saved." };
}
export async function publishProfile(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const b = await ctx(f);
  const turnOn = t(f, "on") !== "no";
  const slug = t(f, "slug").toLowerCase();
  if (turnOn) {
    const c = await brand.checkSlug(b.client, b.workspaceId, slug);
    if (c.ok && !c.value.ok)
      return bad({
        slug:
          c.value.reason === "taken"
            ? "That address is taken."
            : c.value.reason === "reserved"
              ? "That word is reserved. Try your brand name."
              : reasonText.slug,
      });
  }
  const r = await brand.publish(b.client, b.workspaceId, turnOn, slug || null);
  if (!r.ok)
    return r.reason === "duplicate"
      ? bad({ slug: "That address is taken." })
      : fail(r);
  done();
  return {
    ok: true,
    message: turnOn
      ? "Published. Anyone with the link can see your public profile."
      : "Unpublished. Your profile is private again.",
  };
}

// ───────── Catalogue, audiences, goals, guidelines, budget, preferences, competitors, socials ─────────
export async function saveProduct(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const errors: Record<string, string> = {};
  if (t(f, "name").length < 2) errors.name = "Name the product or service.";
  if (!httpsOrEmpty(t(f, "url")))
    errors.url = "Use a full https:// address, or leave it empty.";
  const min = t(f, "price_min") ? Number(t(f, "price_min")) : null;
  const max = t(f, "price_max") ? Number(t(f, "price_max")) : null;
  if ((min !== null && !(min >= 0)) || (max !== null && !(max >= 0)))
    errors.price_min = "Prices are numbers of 0 or more.";
  else if (min !== null && max !== null && max < min)
    errors.price_max = "The upper price is below the lower one.";
  if (Object.keys(errors).length) return bad(errors);
  const b = await ctx(f);
  if (b.limited) return { message: reasonText.rate };
  const id = uuid.safeParse(t(f, "id"));
  const r = await brand.saveProduct(
    b.client,
    b.workspaceId,
    id.success ? id.data : null,
    {
      name: t(f, "name"),
      kind: t(f, "kind"),
      description: t(f, "description") || null,
      url: t(f, "url") || null,
      currency: t(f, "currency") || "INR",
      price_min: min,
      price_max: max,
      claims: lines(f, "claims"),
      segment_ids: many(f, "segment_ids"),
      status: t(f, "status") || "active",
    },
  );
  if (!r.ok) return fail(r);
  done();
  return { ok: true, message: id.success ? "Saved." : "Added." };
}
export async function saveSegment(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  if (t(f, "name").length < 2)
    return bad({ name: "Name this customer group." });
  const amin = t(f, "age_min") ? Number(t(f, "age_min")) : null;
  const amax = t(f, "age_max") ? Number(t(f, "age_max")) : null;
  if (
    (amin !== null && !(amin >= 18 && amin <= 100)) ||
    (amax !== null && !(amax >= 18 && amax <= 100))
  )
    return bad({ age_min: "Ages are 18 to 100." });
  if (amin !== null && amax !== null && amax < amin)
    return bad({ age_max: "The upper age is below the lower one." });
  const b = await ctx(f);
  const id = uuid.safeParse(t(f, "id"));
  const r = await brand.saveSegment(
    b.client,
    b.workspaceId,
    id.success ? id.data : null,
    {
      name: t(f, "name"),
      description: t(f, "description") || null,
      countries: lines(f, "countries"),
      languages: lines(f, "languages"),
      age_min: amin,
      age_max: amax,
      interests: lines(f, "interests"),
      considerations: t(f, "considerations") || null,
      basis: on(f, "confirmed") ? "confirmed" : "hypothesis",
    },
  );
  if (!r.ok) return fail(r);
  done();
  return { ok: true, message: id.success ? "Saved." : "Added." };
}
export async function saveGoal(_p: FormState, f: FormData): Promise<FormState> {
  const target = Number(t(f, "target"));
  const errors: Record<string, string> = {};
  if (t(f, "metric").length < 2) errors.metric = "Say what you will measure.";
  if (!(target > 0)) errors.target = "Enter a target above 0.";
  if (t(f, "baseline") && !(Number(t(f, "baseline")) >= 0))
    errors.baseline = "A number of 0 or more.";
  if (Object.keys(errors).length) return bad(errors);
  const b = await ctx(f);
  const id = uuid.safeParse(t(f, "id"));
  const r = await brand.saveGoal(
    b.client,
    b.workspaceId,
    id.success ? id.data : null,
    {
      kind: t(f, "kind"),
      metric: t(f, "metric"),
      baseline: t(f, "baseline") || null,
      target,
      horizon_days: t(f, "horizon_days"),
      note: t(f, "note") || null,
    },
  );
  if (!r.ok) return fail(r);
  done();
  return { ok: true, message: id.success ? "Saved." : "Goal added." };
}
export async function saveGuideline(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const colours = lines(f, "colours").map((c) =>
    c.startsWith("#") ? c : "#" + c,
  );
  if (colours.some((c) => !/^#[0-9a-fA-F]{6}$/.test(c)))
    return bad({ colours: "Use six-digit hex colours, for example #5B4BD6." });
  const b = await ctx(f);
  const r = await brand.saveGuideline(b.client, b.workspaceId, {
    tone: lines(f, "tone"),
    voice: t(f, "voice") || null,
    dos: lines(f, "dos"),
    donts: lines(f, "donts"),
    colours,
    visual: t(f, "visual") || null,
    claims_rules: t(f, "claims_rules") || null,
    exclusions: t(f, "exclusions") || null,
    disclosures: t(f, "disclosures") || null,
  });
  if (!r.ok) return fail(r);
  done();
  return { ok: true, message: "Saved." };
}
export async function saveBudget(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const b = await ctx(f);
  if (t(f, "clear") === "1") {
    await brand.saveBudget(b.client, b.workspaceId, null);
    done();
    return { ok: true, message: "Budget removed." };
  }
  const min = t(f, "range_min") ? Number(t(f, "range_min")) : null;
  const max = t(f, "range_max") ? Number(t(f, "range_max")) : null;
  if (min === null && max === null)
    return bad({ range_min: "Enter at least one amount, or skip the budget." });
  if ((min !== null && !(min >= 0)) || (max !== null && !(max >= 0)))
    return bad({ range_min: "Amounts are numbers of 0 or more." });
  if (min !== null && max !== null && max < min)
    return bad({ range_max: "The upper amount is below the lower one." });
  const share = t(f, "creator_share") ? Number(t(f, "creator_share")) : null;
  if (share !== null && !(share >= 0 && share <= 100))
    return bad({ creator_share: "A percentage from 0 to 100." });
  const r = await brand.saveBudget(b.client, b.workspaceId, {
    currency: t(f, "currency") || "INR",
    range_min: min,
    range_max: max,
    period: t(f, "period") || "month",
    creator_share: share,
    note: t(f, "note") || null,
  });
  if (!r.ok) return fail(r);
  done();
  return {
    ok: true,
    message: "Saved. It is indicative only and never a commitment.",
  };
}
export async function savePref(_p: FormState, f: FormData): Promise<FormState> {
  const b = await ctx(f);
  const r = await brand.savePref(b.client, b.workspaceId, {
    niches: lines(f, "niches"),
    formats: lines(f, "formats"),
    languages: lines(f, "languages"),
    platforms: many(f, "platforms"),
    countries: lines(f, "countries"),
    experience: many(f, "experience"),
    ugc_interest: on(f, "ugc_interest"),
    conflict_categories: lines(f, "conflict_categories"),
    note: t(f, "note") || null,
  });
  if (!r.ok) return fail(r);
  done();
  return { ok: true, message: "Saved as defaults for future campaigns." };
}
export async function saveCompetitor(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  if (t(f, "name").length < 2) return bad({ name: "Name the competitor." });
  if (!httpsOrEmpty(t(f, "website")))
    return bad({ website: "Use a full https:// address, or leave it empty." });
  const b = await ctx(f);
  const r = await brand.saveCompetitor(b.client, b.workspaceId, {
    name: t(f, "name"),
    website: t(f, "website") || null,
    note: t(f, "note") || null,
    conflict: on(f, "conflict"),
  });
  if (!r.ok) return fail(r);
  done();
  return { ok: true, message: "Added." };
}
export async function saveSocial(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const handle = t(f, "handle").replace(/^@/, "");
  if (!/^[A-Za-z0-9._-]{1,60}$/.test(handle))
    return bad({ handle: "Use the handle only, for example hostelco." });
  const followers = t(f, "followers") ? Number(t(f, "followers")) : null;
  if (followers !== null && !(Number.isInteger(followers) && followers >= 0))
    return bad({ followers: "A whole number of 0 or more." });
  const b = await ctx(f);
  const r = await brand.saveSocial(b.client, b.workspaceId, {
    platform: t(f, "platform"),
    handle,
    followers,
    observed_on: t(f, "observed_on") || null,
  });
  if (!r.ok)
    return r.reason === "limit"
      ? { message: "A Brand workspace can list at most 10 social accounts." }
      : r.reason === "invalid"
        ? bad({ observed_on: "Use a date that is not in the future." })
        : fail(r);
  done();
  return {
    ok: true,
    message: "Added. Counts are labelled as self-reported with their date.",
  };
}
export async function removeItem(f: FormData) {
  const b = await ctx(f);
  const id = uuid.safeParse(t(f, "id"));
  const kind = t(f, "kind");
  if (id.success) await brand.remove(b.client, b.workspaceId, kind, id.data);
  done();
  const back = t(f, "back");
  redirect(
    /^\/brand(\/[a-z/-]+)?$/.test(back)
      ? `${back}?w=${b.workspaceId}`
      : `/brand?w=${b.workspaceId}`,
  );
}
export async function saveMaturity(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const b = await ctx(f);
  const answers: Record<string, string> = {};
  for (const k of ["presence", "content", "creators", "measurement", "process"])
    if (t(f, k)) answers[k] = t(f, k);
  const r = await brand.saveMaturity(b.client, b.workspaceId, answers);
  if (!r.ok) return fail(r);
  done();
  return {
    ok: true,
    message: "Saved. Your plan suggestions now reflect these answers.",
  };
}

// ───────── Plans (F44) ─────────
export async function regeneratePlan(f: FormData) {
  const b = await ctx(f);
  const h = Number(t(f, "horizon")) as Horizon;
  await regenerate(
    b,
    (horizons as readonly number[]).includes(h) ? h : undefined,
  );
  done();
  redirect(`/brand/plan?w=${b.workspaceId}&refreshed=1`);
}
export async function planItem(f: FormData) {
  const b = await ctx(f);
  const id = uuid.safeParse(t(f, "id"));
  if (id.success)
    await brand.planItem(b.client, b.workspaceId, id.data, "done");
  done();
  redirect(`/brand/plan?w=${b.workspaceId}`);
}
export async function editPlanItem(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  if (t(f, "title").length < 3) return bad({ title: "At least 3 characters." });
  const b = await ctx(f);
  const id = uuid.safeParse(t(f, "id"));
  const r = id.success
    ? await brand.planItem(
        b.client,
        b.workspaceId,
        id.data,
        "edit",
        t(f, "title"),
        t(f, "detail"),
      )
    : await brand.planItem(
        b.client,
        b.workspaceId,
        null,
        "add",
        t(f, "title"),
        t(f, "detail"),
        Number(t(f, "horizon")),
      );
  if (!r.ok) return fail(r);
  done();
  return {
    ok: true,
    message: id.success
      ? "Saved. Regenerating the plan keeps this step."
      : "Added to your plan.",
  };
}

// ───────── Verification (F31–F37) ─────────
export async function saveCase(_p: FormState, f: FormData): Promise<FormState> {
  const errors: Record<string, string> = {};
  if (!httpsOrEmpty(t(f, "website")))
    errors.website = "Use a full https:// address, or leave it empty.";
  if (
    t(f, "contact_email") &&
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t(f, "contact_email"))
  )
    errors.contact_email = "Enter a valid email address.";
  if (
    t(f, "id_document_last4") &&
    !/^[A-Za-z0-9]{4}$/.test(t(f, "id_document_last4"))
  )
    errors.id_document_last4 =
      "Exactly 4 letters or digits. Never the full number.";
  if (
    t(f, "registration_number") &&
    (t(f, "registration_number").length < 3 ||
      t(f, "registration_number").length > 40)
  )
    errors.registration_number = "3 to 40 characters.";
  if (Object.keys(errors).length) return bad(errors);
  const b = await ctx(f);
  if (b.limited) return { message: reasonText.rate };
  const fields: Record<string, string | null> = {};
  for (const k of [
    "business_type",
    "legal_name",
    "registration_country",
    "registration_number",
    "registered_address",
    "representative_name",
    "representative_role",
    "id_document_type",
    "id_document_last4",
    "website",
    "contact_email",
    "note",
  ])
    if (f.has(k)) fields[k] = t(f, k) || null;
  const r = await brand.caseSave(b.client, b.workspaceId, fields);
  if (!r.ok) return fail(r);
  if (t(f, "submit") === "1") {
    if (!on(f, "declare"))
      return {
        ...bad({ declare: reasonText.declaration }),
        message: "Saved as a draft. " + reasonText.declaration,
      };
    const s = await brand.caseSubmit(b.client, b.workspaceId, true);
    if (!s.ok) return fail(s);
    done();
    return {
      ok: true,
      message: s.value.paused
        ? "Submitted. Publishing and outreach are paused until a reviewer confirms the change."
        : "Submitted. A reviewer will check it; you will see the result here.",
    };
  }
  done();
  return { ok: true, message: "Draft saved." };
}
export async function withdrawCase(f: FormData) {
  const b = await ctx(f);
  await brand.caseWithdraw(b.client, b.workspaceId);
  done();
  redirect(`/brand/verification?w=${b.workspaceId}`);
}
export async function appealCase(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  if (t(f, "reason").length < 20)
    return bad({ reason: "Explain why in at least 20 characters." });
  const b = await ctx(f);
  const r = await brand.caseAppeal(b.client, b.workspaceId, t(f, "reason"));
  if (!r.ok) return fail(r);
  done();
  return {
    ok: true,
    message: "Appeal submitted. A different reviewer will decide it.",
  };
}
export async function reviewDecide(f: FormData) {
  const { client } = await eligible();
  const id = uuid.safeParse(t(f, "id"));
  let q = "decided=1";
  if (id.success) {
    const r = await brand.reviewDecide(
      client,
      id.data,
      t(f, "decision"),
      t(f, "reason"),
    );
    if (!r.ok) q = "notice=1";
  }
  redirect(`/admin/verification${id.success ? `?case=${id.data}&` : "?"}${q}`);
}
