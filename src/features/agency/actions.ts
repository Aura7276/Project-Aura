"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { eligible } from "@/server/auth/session";
import { ACTING_COOKIE, agency, delegationFor } from "@/server/agency/service";
import { rateLimited } from "@/server/security/rate-limit";
import { agencyContext } from "./context";
import { scopeOrder } from "./rules";

export type FormState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
  link?: string;
} | null;
const uuid = z.uuid();
const t = (f: FormData, k: string) =>
  typeof f.get(k) === "string" ? String(f.get(k)).trim() : "";
const id = (f: FormData, k: string) => {
  const r = uuid.safeParse(t(f, k));
  return r.success ? r.data : null;
};
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const scopes = (f: FormData) =>
  f
    .getAll("scopes")
    .map(String)
    .filter((s) => (scopeOrder as string[]).includes(s));
const months = (f: FormData) => {
  const n = Number(t(f, "months"));
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : 0;
};
const done = () => {
  revalidatePath("/agency", "layout");
  revalidatePath("/brand", "layout");
  revalidatePath("/creator", "layout");
};
const site = () => process.env.AURA_SITE_URL ?? "";

// ───────── Agency side ─────────
export async function saveProfile(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const a = await agencyContext(id(f, "w") ?? undefined);
  const website = t(f, "website");
  const errors: Record<string, string> = {};
  if (t(f, "legal_name").length < 2)
    errors.legal_name = "Add your registered business name.";
  if (website && !/^https:\/\/\S{3,}$/.test(website))
    errors.website = "Use a full https:// address.";
  if (Object.keys(errors).length)
    return { errors, message: "Please check the highlighted fields." };
  const r = await agency.saveProfile(a.client, a.workspaceId, {
    legal_name: t(f, "legal_name"),
    kind: t(f, "kind"),
    website: website || null,
    country: t(f, "country") || null,
    city: t(f, "city"),
    services: f.getAll("services").map(String),
    team_size: t(f, "team_size") || null,
    about: t(f, "about"),
  });
  if (!r.ok) return { message: r.message };
  done();
  return { ok: true, message: "Agency profile saved." };
}
export async function saveVerification(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const a = await agencyContext(id(f, "w") ?? undefined);
  const submit = t(f, "submit") === "1";
  const evidence = t(f, "evidence")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
  if (evidence.some((e) => !/^https:\/\/\S{3,}$/.test(e)))
    return {
      errors: { evidence: "One https link per line." },
      message: "Evidence must be https links.",
    };
  const r = await agency.saveVerification(
    a.client,
    a.workspaceId,
    {
      registration_type: t(f, "registration_type") || null,
      registration_number: t(f, "registration_number"),
      address: t(f, "address"),
      representative: t(f, "representative"),
      representative_role: t(f, "representative_role"),
      evidence,
      declaration: f.get("declaration") === "on",
    },
    submit,
  );
  if (!r.ok) return { message: r.message };
  done();
  return {
    ok: true,
    message: submit
      ? "Sent to a reviewer. You will see the decision here."
      : "Saved. Submit when everything is ready.",
  };
}
export async function inviteClient(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const a = await agencyContext(id(f, "w") ?? undefined);
  const label = t(f, "label");
  const s = scopes(f);
  const m = months(f);
  const errors: Record<string, string> = {};
  if (label.length < 2)
    errors.label = "Name the client so you recognise the invitation.";
  if (!s.length) errors.scopes = "Choose at least one area.";
  if (!m) errors.months = "Choose 1 to 12 months.";
  if (Object.keys(errors).length)
    return {
      errors,
      message: errors.scopes ?? "Please check the highlighted fields.",
    };
  if (rateLimited("agency-invite:" + a.userId, 60))
    return {
      message: "You are going a little fast. Please try again in a moment.",
    };
  const r = await agency.inviteClient(
    a.client,
    a.workspaceId,
    t(f, "kind"),
    label,
    s,
    f.get("contracting") === "on",
    m,
    t(f, "message") || null,
  );
  if (!r.ok) return { message: r.message };
  done();
  return {
    ok: true,
    message:
      "Invitation ready. Send this private link to your client; it is shown once and works for 14 days.",
    link: `${site()}/agency-invite/${r.value}`,
  };
}
export async function revokeInvite(f: FormData) {
  const a = await agencyContext(id(f, "w") ?? undefined);
  const created = t(f, "created");
  if (created) await agency.revokeInvite(a.client, a.workspaceId, created);
  done();
  redirect(`/agency/clients?w=${a.workspaceId}`);
}
export async function inviteMember(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const a = await agencyContext(id(f, "w") ?? undefined);
  const email = t(f, "email");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return {
      errors: { email: "Enter a valid email address." },
      message: "Enter a valid email address.",
    };
  const r = await agency.inviteMember(
    a.client,
    a.workspaceId,
    email,
    t(f, "role") === "admin" ? "admin" : "member",
  );
  if (!r.ok) return { message: r.message };
  done();
  return {
    ok: true,
    message:
      "Invitation ready. Send this code; they enter it on their Workspaces page after signing in. It works for 7 days.",
    link: r.value,
  };
}
export async function assign(f: FormData) {
  const a = await agencyContext(id(f, "w") ?? undefined);
  const rel = id(f, "rel");
  const user = id(f, "user");
  const role = t(f, "role");
  let q = "assigned=1";
  if (rel && user) {
    const r = await agency.assign(
      a.client,
      a.workspaceId,
      rel,
      user,
      role === "remove" ? null : role === "viewer" ? "viewer" : "manager",
    );
    if (!r.ok) q = "error=" + encodeURIComponent(r.message);
  }
  done();
  redirect(`/agency/clients/${rel ?? ""}?w=${a.workspaceId}&${q}`);
}
export async function endRelationship(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const a = await agencyContext(id(f, "w") ?? undefined);
  const rel = id(f, "rel");
  if (!rel) return { message: "We could not do that. Please try again." };
  if (f.get("confirm") !== "on")
    return {
      errors: { confirm: "Tick the box to confirm." },
      message: "Tick the box to confirm.",
    };
  const r = await agency.end(a.client, a.workspaceId, rel, t(f, "reason"));
  if (!r.ok) return { message: r.message, errors: { reason: r.message } };
  done();
  return {
    ok: true,
    message:
      "Offboarded. Access is removed; agreements, fees and the activity record are kept.",
  };
}
export async function requestApproval(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const a = await agencyContext(id(f, "w") ?? undefined);
  const rel = id(f, "rel");
  const title = t(f, "title");
  const link = t(f, "link");
  if (!rel)
    return { errors: { rel: "Choose a client." }, message: "Choose a client." };
  if (title.length < 3)
    return {
      errors: { title: "Say what needs approval." },
      message: "Say what needs approval.",
    };
  if (link && !/^\/(brand|creator|agency)\/[A-Za-z0-9/_?=&.-]*$/.test(link))
    return {
      errors: {
        link: "Use a link inside AURA, starting with /brand or /creator.",
      },
      message: "Please check the highlighted fields.",
    };
  const r = await agency.requestApproval(
    a.client,
    a.workspaceId,
    rel,
    title,
    t(f, "detail") || null,
    link || null,
  );
  if (!r.ok) return { message: r.message };
  done();
  return {
    ok: true,
    message:
      "Request created. An Agency admin reviews it first; the client decides separately.",
  };
}
export async function internalDecide(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const a = await agencyContext(id(f, "w") ?? undefined);
  const ap = id(f, "id");
  if (!ap) return { message: "We could not do that. Please try again." };
  const r = await agency.internalDecide(
    a.client,
    a.workspaceId,
    ap,
    t(f, "decision") === "approved" ? "approved" : "changes_requested",
    t(f, "note") || null,
  );
  if (!r.ok) return { message: r.message };
  done();
  return {
    ok: true,
    message: "Internal review saved. The client still decides for themselves.",
  };
}
export async function disclose(_p: FormState, f: FormData): Promise<FormState> {
  const a = await agencyContext(id(f, "w") ?? undefined);
  const creator = id(f, "creator");
  const brandWs = id(f, "brand");
  const note = t(f, "note");
  const safeguards = t(f, "safeguards");
  const errors: Record<string, string> = {};
  if (note.length < 20)
    errors.note = "Explain the relationship in at least 20 characters.";
  if (safeguards.length < 20)
    errors.safeguards = "Describe the safeguards in at least 20 characters.";
  if (!creator || !brandWs)
    return { message: "We could not do that. Please try again." };
  if (Object.keys(errors).length)
    return { errors, message: "Please check the highlighted fields." };
  const r = await agency.disclose(
    a.client,
    a.workspaceId,
    creator,
    brandWs,
    note,
    safeguards,
  );
  if (!r.ok) return { message: r.message };
  done();
  return {
    ok: true,
    message:
      "Disclosed to both clients. Application and contracting steps unlock once both acknowledge.",
  };
}
export async function saveFee(_p: FormState, f: FormData): Promise<FormState> {
  const a = await agencyContext(id(f, "w") ?? undefined);
  const rel = id(f, "rel");
  const amount = Number(t(f, "amount"));
  const status = t(f, "status") || "planned";
  const errors: Record<string, string> = {};
  if (!rel) errors.rel = "Choose a client.";
  if (t(f, "description").length < 3) errors.description = "Describe the fee.";
  if (!Number.isFinite(amount) || amount <= 0)
    errors.amount = "Enter an amount above 0.";
  for (const k of ["period_start", "period_end", "due_on", "paid_on"])
    if (t(f, k) && !isDate(t(f, k))) errors[k] = "Choose a date.";
  if (status === "paid" && !t(f, "paid_on"))
    errors.paid_on = "Add the date it was paid.";
  if (Object.keys(errors).length)
    return { errors, message: "Please check the highlighted fields." };
  const r = await agency.saveFee(a.client, a.workspaceId, id(f, "id"), {
    relationship_id: rel,
    kind: t(f, "kind"),
    description: t(f, "description"),
    amount,
    currency: t(f, "currency") || "INR",
    basis: t(f, "basis"),
    period_start: t(f, "period_start") || null,
    period_end: t(f, "period_end") || null,
    due_on: t(f, "due_on") || null,
    status,
    reference: t(f, "reference"),
    paid_on: status === "paid" ? t(f, "paid_on") : null,
  });
  if (!r.ok) return { message: r.message };
  done();
  return {
    ok: true,
    message:
      "Fee saved. It is your Agency's revenue, kept apart from the client's campaign spend.",
  };
}
/** Start working inside a client's workspace. The cookie only chooses; the database checks the delegation on every call. */
export async function workFor(f: FormData) {
  const { client } = await eligible();
  const ws = id(f, "client");
  const d = await delegationFor(client, ws);
  if (!d)
    redirect(
      "/agency?error=" +
        encodeURIComponent("That access has ended or expired."),
    );
  (await cookies()).set(ACTING_COOKIE, d.client_ws, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 8 * 3600,
  });
  redirect(
    d.kind === "brand" ? `/brand?w=${d.client_ws}` : "/creator/dashboard",
  );
}
export async function stopWorking() {
  (await cookies()).delete(ACTING_COOKIE);
  redirect("/agency");
}

// ───────── Client side (only the client's own people) ─────────
const backFor = (kind: string) =>
  kind === "brand" ? "/brand/agencies" : "/creator/agencies";
export async function acceptInvite(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const { client } = await eligible();
  const token = t(f, "token");
  const ws = id(f, "client");
  const s = scopes(f);
  const m = months(f);
  if (!ws)
    return {
      errors: { client: "Choose the workspace." },
      message: "Choose the workspace.",
    };
  if (!s.length)
    return {
      errors: { scopes: "Choose at least one area." },
      message: "Choose at least one area.",
    };
  if (!m)
    return {
      errors: { months: "Choose how long." },
      message: "Choose how long.",
    };
  if (f.get("confirm") !== "on")
    return {
      errors: { confirm: "Tick the box to confirm." },
      message: "Tick the box to confirm.",
    };
  const r = await agency.accept(
    client,
    token,
    ws,
    s,
    f.get("contracting") === "on",
    m,
  );
  if (!r.ok) return { message: r.message };
  done();
  redirect(`${backFor(t(f, "kind"))}?w=${ws}&granted=1`);
}
export async function changeGrant(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const { client } = await eligible();
  const ws = id(f, "w");
  const rel = id(f, "rel");
  const s = scopes(f);
  const m = months(f);
  if (!ws || !rel)
    return { message: "We could not do that. Please try again." };
  if (!s.length)
    return {
      errors: { scopes: "Choose at least one area, or end access below." },
      message: "Choose at least one area, or end access below.",
    };
  if (!m)
    return {
      errors: { months: "Choose how long." },
      message: "Choose how long.",
    };
  const r = await agency.clientGrant(
    client,
    ws,
    rel,
    s,
    f.get("contracting") === "on",
    m,
  );
  if (!r.ok) return { message: r.message };
  done();
  return { ok: true, message: "Access updated. It applies immediately." };
}
export async function revokeAccess(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const { client } = await eligible();
  const ws = id(f, "w");
  const rel = id(f, "rel");
  if (!ws || !rel)
    return { message: "We could not do that. Please try again." };
  if (f.get("confirm") !== "on")
    return {
      errors: { confirm: "Tick the box to confirm." },
      message: "Tick the box to confirm.",
    };
  const r = await agency.clientEnd(client, ws, rel, t(f, "reason") || null);
  if (!r.ok) return { message: r.message };
  done();
  return {
    ok: true,
    message: "Access ended immediately. Past activity and fees stay on record.",
  };
}
export async function clientDecide(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const { client } = await eligible();
  const ws = id(f, "w");
  const ap = id(f, "id");
  if (!ws || !ap) return { message: "We could not do that. Please try again." };
  const r = await agency.clientDecide(
    client,
    ws,
    ap,
    t(f, "decision") === "approved" ? "approved" : "declined",
    t(f, "note") || null,
  );
  if (!r.ok) return { message: r.message };
  done();
  return { ok: true, message: "Your decision is recorded." };
}
export async function acknowledge(f: FormData) {
  const { client } = await eligible();
  const ws = id(f, "w");
  const d = id(f, "id");
  if (ws && d) await agency.acknowledge(client, ws, d);
  done();
  redirect(`${backFor(t(f, "kind"))}?w=${ws ?? ""}&acknowledged=1`);
}

// ───────── Platform review ─────────
export async function reviewDecide(
  _p: FormState,
  f: FormData,
): Promise<FormState> {
  const { client } = await eligible();
  const ws = id(f, "ws");
  if (!ws) return { message: "We could not do that. Please try again." };
  const r = await agency.reviewDecide(
    client,
    ws,
    t(f, "decision"),
    t(f, "note") || null,
  );
  if (!r.ok) return { message: r.message };
  revalidatePath("/admin/agencies");
  return { ok: true, message: "Decision recorded." };
}
