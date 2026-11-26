"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { studioContext } from "@/server/studio/service";
import { eligible } from "@/server/auth/session";
import { brandContext } from "@/server/market/service";
import { apply, reasonText } from "@/server/apply/service";
import { rateLimited } from "@/server/security/rate-limit";
import {
  fieldErrors,
  questionsForm,
  termsForm,
  toTerms,
  type FieldErrors,
} from "./schemas";

export type FormState = {
  ok?: boolean;
  message?: string;
  errors?: FieldErrors;
  id?: string;
  savedAt?: string;
} | null;
const uuid = z.uuid();
const t = (f: FormData, k: string) =>
  typeof f.get(k) === "string" ? String(f.get(k)) : "";
const on = (f: FormData, k: string) => f.get(k) === "on";
const done = () => {
  revalidatePath("/creator", "layout");
  revalidatePath("/brand", "layout");
};
async function creator() {
  const c = await studioContext();
  return { ...c, limited: rateLimited("apply:" + c.userId, 120) };
}
const bTarget = (f: FormData) => {
  const w = uuid.safeParse(t(f, "w"));
  return w.success ? w.data : undefined;
};
async function brand(f: FormData) {
  const b = await brandContext(bTarget(f));
  return { ...b, limited: rateLimited("brand-apply:" + b.userId, 120) };
}
const busy = { message: reasonText.rate };
const bad = { message: "Please check the highlighted fields." };

/** What a Creator chose to share in an application. Nothing else from the workspace is ever attached. */
function content(f: FormData) {
  const answers: Record<string, string> = {};
  for (const [k, v] of f.entries())
    if (k.startsWith("q_") && typeof v === "string")
      answers[k.slice(2)] = v.slice(0, 1000);
  const amount = Number(t(f, "quote_amount"));
  return {
    pitch: t(f, "pitch").slice(0, 3000),
    account_id: t(f, "account_id") || null,
    portfolio_ids: f
      .getAll("portfolio")
      .map(String)
      .filter((x) => uuid.safeParse(x).success)
      .slice(0, 12),
    kit_id: t(f, "kit_id") || null,
    kit_rates: on(f, "kit_rates"),
    answers,
    ...(amount > 0
      ? {
          quote: {
            currency: t(f, "quote_currency") || "INR",
            amount,
            note: t(f, "quote_note").slice(0, 300),
          },
        }
      : {}),
  };
}
// ───────── Creator: applying ─────────
export async function saveDraft(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const campaign = uuid.safeParse(t(f, "campaign"));
  const request = uuid.safeParse(t(f, "draft_key") || t(f, "request"));
  if (!campaign.success || !request.success)
    return { message: reasonText.generic };
  const c = await creator();
  if (c.limited) return busy;
  const r = await apply.saveDraft(
    c.client,
    c.workspaceId,
    request.data,
    campaign.data,
    content(f),
  );
  if (!r.ok) return { message: reasonText[r.reason] };
  return {
    ok: true,
    id: r.value.id,
    savedAt: r.value.saved_at,
    message: "Draft saved. Only you can see it.",
  };
}
export async function submitApplication(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const campaign = uuid.safeParse(t(f, "campaign"));
  const request = uuid.safeParse(t(f, "draft_key") || t(f, "request"));
  if (!campaign.success || !request.success)
    return { message: reasonText.generic };
  if (!on(f, "confirm"))
    return {
      errors: { confirm: reasonText.confirm },
      message: reasonText.confirm,
    };
  const c = await creator();
  if (c.limited) return busy;
  const d = await apply.saveDraft(
    c.client,
    c.workspaceId,
    request.data,
    campaign.data,
    content(f),
  );
  if (!d.ok) return { message: reasonText[d.reason] };
  const r = await apply.submit(c.client, c.workspaceId, d.value.id, true);
  if (!r.ok) {
    const field = {
      pitch: "pitch",
      account: "account_id",
      answers: "answers",
      confirm: "confirm",
    }[r.reason as string];
    return {
      message: reasonText[r.reason],
      errors: field ? { [field]: reasonText[r.reason] } : undefined,
    };
  }
  done();
  redirect(`/creator/applications/${d.value.id}?sent=1`);
}
export async function deleteDraft(f: FormData) {
  const id = uuid.safeParse(t(f, "id"));
  const c = await creator();
  if (id.success) await apply.deleteDraft(c.client, c.workspaceId, id.data);
  done();
  redirect("/creator/applications?deleted=1");
}
export async function editApplication(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const id = uuid.safeParse(t(f, "id"));
  if (!id.success) return { message: reasonText.generic };
  if (!on(f, "confirm"))
    return {
      errors: { confirm: reasonText.confirm },
      message: reasonText.confirm,
    };
  const c = await creator();
  if (c.limited) return busy;
  const r = await apply.edit(
    c.client,
    c.workspaceId,
    id.data,
    content(f),
    true,
  );
  if (!r.ok) return { message: reasonText[r.reason] };
  done();
  return {
    ok: true,
    message:
      "Sent as a new version. The Brand was told it changed; the earlier version is kept.",
  };
}
export async function withdrawApplication(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const id = uuid.safeParse(t(f, "id"));
  if (!id.success) return { message: reasonText.generic };
  if (!on(f, "confirm"))
    return {
      errors: { confirm: "Tick the box to confirm the withdrawal." },
      message: "Tick the box to confirm the withdrawal.",
    };
  const c = await creator();
  const r = await apply.withdraw(c.client, c.workspaceId, id.data, true);
  if (!r.ok) return { message: reasonText[r.reason] };
  done();
  redirect(`/creator/applications/${id.data}?withdrawn=1`);
}
export async function answerClarification(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const id = uuid.safeParse(t(f, "id"));
  const answer = t(f, "answer").trim();
  if (!id.success) return { message: reasonText.generic };
  if (answer.length < 2)
    return { errors: { answer: "Write your answer." }, ...bad };
  const c = await creator();
  if (c.limited) return busy;
  const r = await apply.answer(c.client, c.workspaceId, id.data, answer);
  if (!r.ok) return { message: reasonText[r.reason] };
  done();
  return { ok: true, message: "Answer sent." };
}
// ───────── Creator: invitations, enquiries, blocking, reports ─────────
export async function respondInvitation(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const id = uuid.safeParse(t(f, "id"));
  const action = t(f, "action");
  const text = t(f, "text").trim();
  if (!id.success || !["interested", "decline", "clarify"].includes(action))
    return { message: reasonText.generic };
  if (action === "clarify" && text.length < 5)
    return {
      errors: { text: "Write your question (at least 5 characters)." },
      ...bad,
    };
  const c = await creator();
  if (c.limited) return busy;
  const r = await apply.respondInvitation(
    c.client,
    c.workspaceId,
    id.data,
    action,
    text || null,
  );
  if (!r.ok) return { message: reasonText[r.reason] };
  done();
  if (action === "interested" && r.value.collaboration_id)
    redirect(`/creator/negotiations/${r.value.collaboration_id}?interested=1`);
  return {
    ok: true,
    message:
      action === "decline"
        ? "Declined. The Brand was told."
        : "Question sent to the Brand.",
  };
}
export async function respondEnquiry(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const id = uuid.safeParse(t(f, "id"));
  const action = t(f, "action");
  if (!id.success || !["interested", "declined"].includes(action))
    return { message: reasonText.generic };
  const c = await creator();
  if (c.limited) return busy;
  const r = await apply.respondEnquiry(
    c.client,
    c.workspaceId,
    id.data,
    action,
    t(f, "reply").trim() || null,
  );
  if (!r.ok) return { message: reasonText[r.reason] };
  done();
  return { ok: true, message: "Reply sent." };
}
export async function setBlock(f: FormData) {
  const brandId = uuid.safeParse(t(f, "brand"));
  const c = await creator();
  if (brandId.success && !c.limited)
    await apply.block(
      c.client,
      c.workspaceId,
      brandId.data,
      t(f, "on") === "yes",
    );
  done();
  const back = t(f, "back");
  redirect(
    /^\/creator\/(invitations|enquiries|settings\/applications)(\/[0-9a-f-]{36})?$/.test(
      back,
    )
      ? `${back}?blocked=1`
      : "/creator/settings/applications",
  );
}
export async function reportItem(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const id = uuid.safeParse(t(f, "id"));
  const kind = t(f, "kind");
  const reason = t(f, "reason");
  if (!id.success || !["invitation", "enquiry", "message"].includes(kind))
    return { message: reasonText.generic };
  if (!reason) return { errors: { reason: "Choose what is wrong." }, ...bad };
  const ws = t(f, "w") ? (await brand(f)).workspaceId : null;
  const ctx = ws ? await brand(f) : await creator();
  if (ctx.limited) return busy;
  const r = await apply.report(
    ctx.client,
    ctx.workspaceId,
    kind,
    id.data,
    reason,
    t(f, "details").slice(0, 1000),
  );
  if (!r.ok) return { message: reasonText[r.reason] };
  return {
    ok: true,
    message:
      "Reported. A reviewer will look at it; you can block this Brand at any time.",
  };
}
export async function markRead(f: FormData) {
  const c = t(f, "w") ? await brand(f) : await creator();
  await apply.read(c.client, c.workspaceId);
  done();
  redirect(t(f, "w") ? "/brand/inbox" : "/creator/applications");
}
// ───────── Both sides: negotiation ─────────
async function side(f: FormData) {
  return t(f, "w") ? await brand(f) : await creator();
}
export async function propose(_p: FormState, f: FormData): Promise<FormState> {
  const id = uuid.safeParse(t(f, "id"));
  if (!id.success) return { message: reasonText.generic };
  const p = termsForm.safeParse(
    Object.fromEntries(
      [
        "currency",
        "amount",
        "deliverables",
        "start_on",
        "end_on",
        "revisions",
        "usage_months",
        "channels",
        "exclusivity_days",
        "note",
        "valid_days",
      ].map((k) => [k, t(f, k)]),
    ),
  );
  if (!p.success) return { errors: fieldErrors(p.error), ...bad };
  const c = await side(f);
  if (c.limited) return busy;
  const r = await apply.propose(
    c.client,
    c.workspaceId,
    id.data,
    toTerms(p.data),
    p.data.note ?? null,
    p.data.valid_days ?? null,
  );
  if (!r.ok) return { message: reasonText[r.reason] };
  done();
  return {
    ok: true,
    message:
      "Proposal sent. Any earlier confirmations were reset, so both sides confirm this exact version.",
  };
}
export async function confirmProposal(f: FormData) {
  const id = uuid.safeParse(t(f, "id"));
  const version = Number(t(f, "version"));
  const c = await side(f);
  const base = t(f, "w")
    ? `/brand/negotiations/${id.success ? id.data : ""}`
    : `/creator/negotiations/${id.success ? id.data : ""}`;
  let q = "confirmed=1";
  if (!id.success || !Number.isInteger(version)) q = "notice=generic";
  else if (!on(f, "agree")) q = "notice=confirm";
  else {
    const r = await apply.confirm(c.client, c.workspaceId, id.data, version);
    q = r.ok
      ? r.value.both_confirmed
        ? "ready=1"
        : "confirmed=1"
      : `notice=${r.reason}`;
  }
  done();
  redirect(`${base}?${q}${t(f, "w") ? `&w=${t(f, "w")}` : ""}`);
}
export async function sendMessage(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const id = uuid.safeParse(t(f, "id"));
  const body = t(f, "body").trim();
  if (!id.success) return { message: reasonText.generic };
  if (body.length < 1 || body.length > 2000)
    return {
      errors: { body: "Write a message of up to 2,000 characters." },
      ...bad,
    };
  const c = await side(f);
  if (c.limited) return busy;
  const r = await apply.message(c.client, c.workspaceId, id.data, body);
  if (!r.ok) return { message: reasonText[r.reason] };
  done();
  return { ok: true, message: "Sent." };
}
// ───────── Brand ─────────
export async function saveRules(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const id = uuid.safeParse(t(f, "id"));
  if (!id.success) return { message: reasonText.generic };
  const cap = (k: string) => (t(f, k) ? Number(t(f, k)) : "");
  for (const k of ["submission_capacity", "selection_capacity"]) {
    const v = cap(k);
    if (v !== "" && (!Number.isInteger(v) || v < 1))
      return {
        errors: {
          [k]: "Enter a whole number of at least 1, or leave it empty.",
        },
        ...bad,
      };
  }
  const qs = questionsForm.parse(t(f, "questions"));
  if (qs.some((q) => q.prompt.length < 5))
    return {
      errors: { questions: "Each question needs at least 5 characters." },
      ...bad,
    };
  const b = await brand(f);
  if (b.limited) return busy;
  const r = await apply.setRules(
    b.client,
    b.workspaceId,
    id.data,
    {
      quick_apply: on(f, "quick_apply"),
      reapply: on(f, "reapply"),
      negotiable: on(f, "negotiable"),
      submission_capacity: cap("submission_capacity"),
      selection_capacity: cap("selection_capacity"),
    },
    t(f, "lock_questions") === "1" ? null : qs,
  );
  if (!r.ok)
    return {
      message: reasonText[r.reason],
      errors:
        r.reason === "custom_work"
          ? { questions: reasonText.custom_work }
          : undefined,
    };
  done();
  return { ok: true, message: "Application rules saved." };
}
export async function decide(_p: FormState, f: FormData): Promise<FormState> {
  const id = uuid.safeParse(t(f, "id"));
  const action = t(f, "action");
  if (
    !id.success ||
    !["review", "shortlist", "waitlist", "select", "reject"].includes(action)
  )
    return { message: reasonText.generic };
  const b = await brand(f);
  if (b.limited) return busy;
  const r = await apply.decide(
    b.client,
    b.workspaceId,
    id.data,
    action,
    t(f, "feedback").trim() || null,
  );
  if (!r.ok) return { message: reasonText[r.reason] };
  done();
  return {
    ok: true,
    message: {
      review: "Marked as in review. The application is now locked.",
      shortlist: "Shortlisted.",
      waitlist: "Waitlisted. The Creator was told this is not a guarantee.",
      select:
        "Selected. This is not an agreement yet: agree the terms in the negotiation.",
      reject: "Not selected. The Creator was told.",
    }[action],
  };
}
export async function askClarification(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const id = uuid.safeParse(t(f, "id"));
  const q = t(f, "question").trim();
  if (!id.success) return { message: reasonText.generic };
  if (q.length < 5)
    return {
      errors: { question: "Write a question of at least 5 characters." },
      ...bad,
    };
  const b = await brand(f);
  if (b.limited) return busy;
  const r = await apply.ask(b.client, b.workspaceId, id.data, q);
  if (!r.ok) return { message: reasonText[r.reason] };
  done();
  return {
    ok: true,
    message: "Question sent. The Creator has 5 days to answer.",
  };
}
/** A Creator is addressed by their published username only. Workspace ids are never shown to Brands. */
const creatorRef = async (
  c: Awaited<ReturnType<typeof brand>>,
  raw: string,
) => {
  const v = raw
    .trim()
    .replace(/^@/, "")
    .replace(/^.*\/creator\//, "");
  if (!/^[a-z0-9._-]{3,30}$/i.test(v)) return null;
  const r = await apply.findCreator(c.client, c.workspaceId, v);
  return r.ok ? r.value : null;
};
export async function invite(_p: FormState, f: FormData): Promise<FormState> {
  const id = uuid.safeParse(t(f, "id"));
  const message = t(f, "message").trim();
  if (!id.success) return { message: reasonText.generic };
  if (message.length < 20)
    return {
      errors: {
        message:
          "Write at least 20 characters so the Creator knows why you are inviting them.",
      },
      ...bad,
    };
  const b = await brand(f);
  if (b.limited) return busy;
  const who = await creatorRef(b, t(f, "creator"));
  if (!who)
    return {
      errors: { creator: "No published Creator profile has that username." },
      ...bad,
    };
  const r = await apply.invite(b.client, b.workspaceId, id.data, who, message);
  if (!r.ok) return { message: reasonText[r.reason] };
  done();
  return {
    ok: true,
    message:
      "Invitation sent. It expires in 14 days. Accepting it is not an agreement.",
  };
}
export async function enquire(_p: FormState, f: FormData): Promise<FormState> {
  const message = t(f, "message").trim();
  const campaign = uuid.safeParse(t(f, "campaign"));
  if (message.length < 20)
    return { errors: { message: "Write at least 20 characters." }, ...bad };
  const b = await brand(f);
  if (b.limited) return busy;
  const who = await creatorRef(b, t(f, "creator"));
  if (!who)
    return {
      errors: { creator: "No published Creator profile has that username." },
      ...bad,
    };
  const r = await apply.enquire(
    b.client,
    b.workspaceId,
    who,
    campaign.success ? campaign.data : null,
    message,
  );
  if (!r.ok) return { message: reasonText[r.reason] };
  done();
  return {
    ok: true,
    message: "Enquiry sent. It is a question, not an invitation.",
  };
}
export async function brandAnswer(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const id = uuid.safeParse(t(f, "id"));
  const answer = t(f, "answer").trim();
  if (!id.success) return { message: reasonText.generic };
  if (answer.length < 2)
    return { errors: { answer: "Write your answer." }, ...bad };
  const b = await brand(f);
  const r = await apply.brandAnswer(b.client, b.workspaceId, id.data, answer);
  if (!r.ok) return { message: reasonText[r.reason] };
  done();
  return { ok: true, message: "Answer sent." };
}
// ───────── Reviewer ─────────
export async function decideReport(f: FormData) {
  const { client } = await eligible();
  const id = uuid.safeParse(t(f, "id"));
  let q = "decided=1";
  if (id.success) {
    const r = await apply.decideReport(
      client,
      id.data,
      t(f, "decision"),
      t(f, "reason"),
    );
    if (!r.ok) q = "notice=1";
  }
  redirect(`/admin/applications?${q}`);
}
