import "server-only";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ServiceError } from "@/server/creator/service";

type Rpc = Pick<SupabaseClient, "rpc">;
export type AgResult<T> =
  { ok: true; value: T } | { ok: false; error: ServiceError; message: string };
const passthrough = [
  /^Only an Agency owner or admin/,
  /^Only the client's owner can grant contracting authority/,
  /^Verify your Agency before inviting clients/,
  /^Access can last 1 to 12 months/,
  /^This invitation is (no longer available|for a .* workspace)/,
  /^You can grant the requested access or less, never more/,
  /^You cannot be your own Agency's client/,
  /^Choose at least one area/,
  /^Granting contracting authority needs your authenticator/,
  /^Contracting authority needs the Applications area/,
  /^Add your registered business name/,
  /^Add the registration, address, representative/,
  /^Evidence must be https links/,
  /^Complete your Agency profile first/,
  /^This verification is already with a reviewer or complete/,
  /^Explain what is needed/,
  /^Give a short reason for the client/,
  /^Only your Agency's team members can be assigned/,
  /^These clients do not work together/,
  /^Enter a valid email address/,
  /^Nothing to (decide|review|cancel)/,
  /^Dual representation: /,
];
const friendly = (code: string | undefined, m: string) => {
  if (passthrough.some((r) => r.test(m))) return m;
  if (code === "42501")
    return "You do not have access to do that. Access is checked every time, so it may have changed or expired.";
  if (code === "22023" || code === "23514" || code === "23505")
    return "Some of that does not fit. Please check it.";
  return "We could not do that. Nothing was lost, so please try again.";
};
// Local copy of the error classes (no runtime import of the Creator service, which imports this module).
const classify = (e: { code?: string } | null): ServiceError =>
  e?.code === "42501"
    ? "denied"
    : e?.code === "40001"
      ? "conflict"
      : e?.code === "55000"
        ? "incomplete"
        : e?.code?.startsWith("22") || e?.code?.startsWith("23")
          ? "invalid"
          : "failed";
async function call<T>(
  c: Rpc,
  fn: string,
  args: Record<string, unknown>,
): Promise<AgResult<T>> {
  const { data, error } = await c.rpc(fn, args);
  if (error || data === null || data === undefined) {
    const e = error as { code?: string; message?: string } | null;
    return {
      ok: false,
      error: classify(error),
      message: friendly(e?.code, e?.message ?? ""),
    };
  }
  return { ok: true, value: data as T };
}

export type Scope =
  | "view"
  | "profile"
  | "campaigns"
  | "applications"
  | "content"
  | "results"
  | "assistant";
export type GrantInfo = {
  scopes: Scope[];
  contracting: boolean;
  expires_at: string;
  granted_at: string;
  granted_by: string;
  expired: boolean;
  days_left: number;
} | null;
export type Delegation = {
  client_ws: string;
  kind: "creator" | "brand";
  name: string;
  agency_ws: string;
  agency: string;
  scopes: Scope[];
  contracting: boolean;
  expires_at: string;
  role: "manager" | "viewer";
  can_write: boolean;
};
export type Client = {
  id: string;
  client_ws: string;
  name: string;
  kind: "creator" | "brand";
  status: "active" | "ended";
  started_at: string;
  ended_at: string | null;
  ended_side: string | null;
  end_reason: string | null;
  grant: GrantInfo;
  my_role: "manager" | "viewer" | null;
  team: { user_id: string; name: string; role: "manager" | "viewer" }[];
  snapshot: Record<string, number> | null;
  pending_approvals: number;
};
export type Approval = {
  id: string;
  relationship_id: string;
  client: string;
  title: string;
  detail: string | null;
  link: string | null;
  requested_by: string;
  requested_at: string;
  internal_status: "pending" | "approved" | "changes_requested";
  internal_by: string | null;
  internal_note: string | null;
  client_status: "pending" | "approved" | "declined";
  client_note: string | null;
  client_at: string | null;
};
export type Fee = {
  id: string;
  relationship_id: string;
  client: string;
  kind: "retainer" | "commission" | "project_fee" | "expense";
  description: string;
  amount: number;
  currency: string;
  basis: string | null;
  period_start: string | null;
  period_end: string | null;
  due_on: string | null;
  status: "planned" | "invoiced" | "paid" | "cancelled";
  reference: string | null;
  paid_on: string | null;
};
export type AgencyState = {
  me: {
    id: string;
    role: "owner" | "admin" | "member";
    admin: boolean;
    strong: boolean;
  };
  workspace: {
    name: string;
    verification: "pending" | "verified" | "revoked";
    status: string;
  };
  profile: {
    legal_name: string | null;
    kind: string;
    website: string | null;
    country: string | null;
    city: string | null;
    services: string[];
    team_size: string | null;
    about: string | null;
    completed_at: string | null;
  } | null;
  verification: {
    status: "draft" | "submitted" | "info_requested" | "verified" | "rejected";
    registration_type: string | null;
    registration_number: string | null;
    address: string | null;
    representative: string | null;
    representative_role: string | null;
    evidence: string[];
    declaration: boolean;
    reviewer_note: string | null;
    submitted_at: string | null;
    decided_at: string | null;
  } | null;
  clients: Client[];
  team: {
    user_id: string;
    name: string;
    role: "owner" | "admin" | "member";
    strong: boolean;
    clients: number;
  }[];
  invites: {
    created_at: string;
    kind: "creator" | "brand";
    label: string;
    scopes: Scope[];
    contracting: boolean;
    months: number;
    expires_at: string;
  }[];
  conflicts: {
    creator_ws: string;
    brand_ws: string;
    creator: string;
    brand: string;
    collaborations: number;
    disclosure: {
      id: string;
      note: string;
      safeguards: string;
      disclosed_at: string;
      creator_ack_at: string | null;
      brand_ack_at: string | null;
    } | null;
  }[];
  approvals: Approval[];
  fees: Fee[];
  activity: {
    client: string;
    by: string;
    action: string;
    scope: string;
    contracting: boolean;
    at: string;
  }[];
};
export type ClientView = {
  me: { owner: boolean; strong: boolean };
  agencies: {
    id: string;
    agency: string;
    legal_name: string | null;
    verified: boolean;
    status: "active" | "ended";
    started_at: string;
    ended_at: string | null;
    ended_side: string | null;
    end_reason: string | null;
    grant: GrantInfo;
    history: {
      scopes: Scope[];
      contracting: boolean;
      granted_at: string;
      granted_by: string;
      expires_at: string;
      ended_at: string | null;
      end_reason: string | null;
    }[];
    team: { name: string; role: string }[];
    activity: {
      by: string;
      action: string;
      scope: string;
      contracting: boolean;
      at: string;
    }[];
    fees: Omit<Fee, "id" | "relationship_id" | "client" | "reference">[];
    approvals: Pick<
      Approval,
      | "id"
      | "title"
      | "detail"
      | "link"
      | "requested_by"
      | "requested_at"
      | "internal_status"
      | "client_status"
      | "client_note"
    >[];
    disclosures: {
      id: string;
      other: string;
      note: string;
      safeguards: string;
      disclosed_at: string;
      acknowledged: boolean;
    }[];
  }[];
};
export type InviteInfo = {
  agency: {
    name: string;
    verified: boolean;
    legal_name: string | null;
    kind: string | null;
    website: string | null;
    about: string | null;
  };
  client_kind: "creator" | "brand";
  client_label: string;
  scopes: Scope[];
  contracting: boolean;
  months: number;
  message: string | null;
  expires_at: string;
  workspaces: { id: string; name: string; role: string }[];
};

export const agency = {
  state: (c: Rpc, ws: string) =>
    call<AgencyState>(c, "aura_agency_state", { p_workspace: ws }),
  saveProfile: (c: Rpc, ws: string, fields: Record<string, unknown>) =>
    call<{ saved: boolean }>(c, "aura_agency_save_profile", {
      p_workspace: ws,
      p_fields: fields,
    }),
  saveVerification: (
    c: Rpc,
    ws: string,
    fields: Record<string, unknown>,
    submit: boolean,
  ) =>
    call<{ status: string }>(c, "aura_agency_save_verification", {
      p_workspace: ws,
      p_fields: fields,
      p_submit: submit,
    }),
  reviewQueue: (c: Rpc) =>
    call<Record<string, unknown>[]>(c, "aura_agency_review_queue", {}),
  reviewDecide: (c: Rpc, ws: string, decision: string, note: string | null) =>
    call<{ status: string }>(c, "aura_agency_review_decide", {
      p_workspace: ws,
      p_decision: decision,
      p_note: note,
    }),
  inviteMember: (c: Rpc, ws: string, email: string, role: string) =>
    call<string>(c, "aura_agency_invite_member", {
      p_workspace: ws,
      p_email: email,
      p_role: role,
    }),
  assign: (
    c: Rpc,
    ws: string,
    rel: string,
    user: string,
    role: string | null,
  ) =>
    call<{ ok: boolean }>(c, "aura_agency_assign", {
      p_workspace: ws,
      p_relationship: rel,
      p_user: user,
      p_role: role,
    }),
  inviteClient: (
    c: Rpc,
    ws: string,
    kind: string,
    label: string,
    scopes: string[],
    contracting: boolean,
    months: number,
    message: string | null,
  ) =>
    call<string>(c, "aura_agency_invite_client", {
      p_workspace: ws,
      p_kind: kind,
      p_label: label,
      p_scopes: scopes,
      p_contracting: contracting,
      p_months: months,
      p_message: message,
    }),
  revokeInvite: (c: Rpc, ws: string, created: string) =>
    call<{ revoked: boolean }>(c, "aura_agency_revoke_invite", {
      p_workspace: ws,
      p_created: created,
    }),
  inviteInfo: (c: Rpc, token: string) =>
    call<InviteInfo>(c, "aura_agency_invite_info", { p_token: token }),
  accept: (
    c: Rpc,
    token: string,
    client: string,
    scopes: string[],
    contracting: boolean,
    months: number,
  ) =>
    call<{ relationship: string }>(c, "aura_agency_accept", {
      p_token: token,
      p_client: client,
      p_scopes: scopes,
      p_contracting: contracting,
      p_months: months,
    }),
  clientGrant: (
    c: Rpc,
    client: string,
    rel: string,
    scopes: string[],
    contracting: boolean,
    months: number,
  ) =>
    call<{ grant: string; expires_at: string }>(c, "aura_agency_client_grant", {
      p_client: client,
      p_relationship: rel,
      p_scopes: scopes,
      p_contracting: contracting,
      p_months: months,
    }),
  clientEnd: (c: Rpc, client: string, rel: string, reason: string | null) =>
    call<{ ended: boolean }>(c, "aura_agency_client_end", {
      p_client: client,
      p_relationship: rel,
      p_reason: reason,
    }),
  end: (c: Rpc, ws: string, rel: string, reason: string) =>
    call<{ ended: boolean }>(c, "aura_agency_end", {
      p_workspace: ws,
      p_relationship: rel,
      p_reason: reason,
    }),
  requestApproval: (
    c: Rpc,
    ws: string,
    rel: string,
    title: string,
    detail: string | null,
    link: string | null,
  ) =>
    call<{ id: string }>(c, "aura_agency_request_approval", {
      p_workspace: ws,
      p_relationship: rel,
      p_title: title,
      p_detail: detail,
      p_link: link,
    }),
  internalDecide: (
    c: Rpc,
    ws: string,
    id: string,
    decision: string,
    note: string | null,
  ) =>
    call<{ internal_status: string }>(c, "aura_agency_internal_decide", {
      p_workspace: ws,
      p_approval: id,
      p_decision: decision,
      p_note: note,
    }),
  clientDecide: (
    c: Rpc,
    client: string,
    id: string,
    decision: string,
    note: string | null,
  ) =>
    call<{ client_status: string }>(c, "aura_agency_client_decide", {
      p_client: client,
      p_approval: id,
      p_decision: decision,
      p_note: note,
    }),
  disclose: (
    c: Rpc,
    ws: string,
    creator: string,
    brand: string,
    note: string,
    safeguards: string,
  ) =>
    call<{ id: string }>(c, "aura_agency_disclose", {
      p_workspace: ws,
      p_creator: creator,
      p_brand: brand,
      p_note: note,
      p_safeguards: safeguards,
    }),
  acknowledge: (c: Rpc, client: string, id: string) =>
    call<{ acknowledged: boolean }>(c, "aura_agency_client_acknowledge", {
      p_client: client,
      p_disclosure: id,
    }),
  saveFee: (
    c: Rpc,
    ws: string,
    id: string | null,
    fields: Record<string, unknown>,
  ) =>
    call<{ id: string }>(c, "aura_agency_save_fee", {
      p_workspace: ws,
      p_id: id,
      p_fields: fields,
    }),
  clientView: (c: Rpc, client: string) =>
    call<ClientView>(c, "aura_agency_client_view", { p_client: client }),
  delegations: (c: Rpc) => call<Delegation[]>(c, "aura_agency_delegations", {}),
};

/** "Working for" a client: a cookie only chooses which delegated client the pages show; the database decides every access. */
export const ACTING_COOKIE = "aura_acting";
export async function actingId() {
  const v = (await cookies()).get(ACTING_COOKIE)?.value ?? "";
  return /^[0-9a-f-]{36}$/i.test(v) ? v : null;
}
/** The delegation the signed-in person may use for a workspace, or null. */
export async function delegationFor(
  c: Rpc,
  ws: string | null | undefined,
  kind?: "creator" | "brand",
) {
  if (!ws) return null;
  const r = await agency.delegations(c);
  if (!r.ok) return null;
  return (
    r.value.find((d) => d.client_ws === ws && (!kind || d.kind === kind)) ??
    null
  );
}
