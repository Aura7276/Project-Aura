import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { classify, type ServiceError } from "@/server/creator/service";

type Rpc = Pick<SupabaseClient, "rpc">;
export type SocialResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      error: ServiceError;
      code: string | null;
      reason: SocialReason;
    };
/** Known, safe failure reasons. Database messages are matched, never displayed. */
export type SocialReason =
  | "limit"
  | "duplicate"
  | "rate"
  | "not_connected"
  | "expired"
  | "conflict"
  | "retained"
  | "unsupported"
  | "generic";
function reasonOf(code: string | null, message: string): SocialReason {
  if (/Social account limit reached/i.test(message)) return "limit";
  if (code === "23505" || /already (added|verified)/i.test(message))
    return "duplicate";
  if (code === "54000") return "rate";
  if (/no provider connection|connected provider/i.test(message))
    return "not_connected";
  if (/expired|attempt limit/i.test(message)) return "expired";
  if (/retained/i.test(message)) return "retained";
  if (code === "40001") return "conflict";
  if (/not supported|does not fit|Invalid/i.test(message)) return "unsupported";
  return "generic";
}
export const reasonText: Record<SocialReason, string> = {
  limit:
    "You have reached the account limit. Archive or remove an account to add another.",
  duplicate: "That account is already added, or is already claimed.",
  rate: "That was requested too recently. Please wait a little and try again.",
  not_connected:
    "This account has no platform connection. Manual tracking is available instead.",
  expired:
    "The verification code has expired. Start verification again for a new code.",
  conflict: "This changed elsewhere. Reload and try again.",
  retained: "That evidence belongs to a decided claim and is retained.",
  unsupported:
    "That value does not fit this platform or metric. Please check it.",
  generic:
    "We could not save that. Nothing was lost on this page, so please try again.",
};
async function call<T>(
  c: Rpc,
  fn: string,
  args: Record<string, unknown>,
): Promise<SocialResult<T>> {
  const { data, error } = await c.rpc(fn, args);
  if (error || data === null || data === undefined) {
    const code = (error as { code?: string } | null)?.code ?? null;
    return {
      ok: false,
      error: classify(error),
      code,
      reason: reasonOf(
        code,
        (error as { message?: string } | null)?.message ?? "",
      ),
    };
  }
  return { ok: true, value: data as T };
}
export type SocialAccountRow = {
  id: string;
  platform: string;
  handle: string;
  profile_url: string | null;
  display_name: string | null;
  account_type: string | null;
  ownership_scope: "individual" | "brand_or_company";
  visibility: "public" | "private" | "unknown";
  content_category: string | null;
  lifecycle: "active" | "disconnected" | "removed" | "archived";
  verification: string;
  connection: "manual" | "connected" | "disconnected";
  is_primary: boolean;
  preferred_for_platform: boolean;
  sharing_visibility: "private" | "published";
  identity_kind: string;
  history_stale_since: string | null;
  created_at: string;
  updated_at: string;
  latest: Record<
    string,
    {
      value: number;
      observed_on: string;
      source: string;
      period_start: string | null;
      period_end: string | null;
    }
  >;
};
export type Accounts = {
  limit: number;
  used: number;
  accounts: SocialAccountRow[];
};
export type Observation = {
  id: string;
  metric: string;
  value: number;
  observed_on: string;
  period_start: string | null;
  period_end: string | null;
  source: string;
  has_evidence: boolean;
  entered_at: string;
  note: string | null;
  supersedes: string | null;
  superseded_by: string | null;
  historical: boolean;
};
export type ObservationPage = {
  items: Observation[];
  next_cursor: { o: string; e: string; i: string } | null;
};
export type ContentRow = {
  id: string;
  external_id: string;
  url: string | null;
  title: string | null;
  format: string | null;
  published_on: string | null;
  latest_lifetime: Record<
    string,
    { value: number; observed_on: string; source: string }
  >;
  window_observations: {
    metric: string;
    value: number;
    period_start: string;
    period_end: string;
    observed_on: string;
    source: string;
  }[];
  observation_count: number;
};
export type Claim = {
  claim_id: string;
  state: string;
  disputed: boolean;
  review_note: string | null;
  decision_reason: string | null;
  decided_at: string | null;
  created_at: string;
  challenge: {
    code: string;
    expires_at: string;
    expired: boolean;
    attempts_left: number;
    consumed: boolean;
  } | null;
  evidence: {
    id: string;
    uploaded_at: string;
    scan_status: string;
    size_bytes: number;
    mime: string;
  }[];
};
export type Verification = { verification: string; claim: Claim | null };
export type Reminders = {
  weekly: boolean;
  reminder_days: number;
  due: {
    account_id: string;
    platform: string;
    handle: string;
    metric: string;
    last_observed_on: string | null;
    days_since: number | null;
  }[];
};
export type Grant = {
  id: string;
  recipient: string;
  fields: string[];
  purpose: string;
  valid_until: string | null;
  status: "active" | "revoked";
  created_at: string;
};
export type Job = {
  id: string;
  kind: string;
  status: string;
  requested_at: string;
  finished_at: string | null;
  error_code: string | null;
};
export type Policy = {
  max_active_accounts: number;
  challenge_ttl_hours: number;
  challenge_max_attempts: number;
  evidence_max_bytes: number;
  refresh_min_interval_minutes: number;
  reminder_days: number;
};
export type QueueItem = {
  claim_id: string;
  state: string;
  platform: string;
  handle: string;
  profile_url: string | null;
  created_at: string;
  dispute: boolean;
  evidence_clean: number;
  evidence_pending: number;
};

export const social = {
  policy: (c: Rpc) => call<Policy>(c, "aura_social_policy", {}),
  accounts: (c: Rpc, ws: string) =>
    call<Accounts>(c, "aura_social_accounts", { p_workspace: ws }),
  account: (c: Rpc, ws: string, id: string) =>
    call<SocialAccountRow>(c, "aura_social_account", {
      p_workspace: ws,
      p_account: id,
    }),
  add: (c: Rpc, ws: string, request: string, account: unknown) =>
    call<SocialAccountRow>(c, "aura_social_add_account", {
      p_workspace: ws,
      p_request: request,
      p_account: account,
    }),
  update: (c: Rpc, ws: string, id: string, patch: unknown) =>
    call<SocialAccountRow>(c, "aura_social_update_account", {
      p_workspace: ws,
      p_account: id,
      p_patch: patch,
    }),
  setPrimary: (c: Rpc, ws: string, id: string) =>
    call<SocialAccountRow>(c, "aura_social_set_primary", {
      p_workspace: ws,
      p_account: id,
    }),
  setPreferred: (c: Rpc, ws: string, id: string, on: boolean) =>
    call<SocialAccountRow>(c, "aura_social_set_preferred", {
      p_workspace: ws,
      p_account: id,
      p_preferred: on,
    }),
  remove: (c: Rpc, ws: string, id: string, replacement: string | null) =>
    call<{ removed: string; new_primary: string | null }>(
      c,
      "aura_social_remove_account",
      { p_workspace: ws, p_account: id, p_replacement: replacement },
    ),
  archive: (c: Rpc, ws: string, id: string, on: boolean) =>
    call<Record<string, unknown>>(c, "aura_social_archive_account", {
      p_workspace: ws,
      p_account: id,
      p_archive: on,
    }),
  disconnect: (c: Rpc, ws: string, id: string) =>
    call<SocialAccountRow>(c, "aura_social_disconnect", {
      p_workspace: ws,
      p_account: id,
    }),
  record: (
    c: Rpc,
    ws: string,
    v: {
      request: string;
      account: string;
      metric: string;
      value: number;
      observed_on: string;
      period_start: string | null;
      period_end: string | null;
      note: string | null;
    },
  ) =>
    call<Observation>(c, "aura_social_record_observation", {
      p_workspace: ws,
      p_request: v.request,
      p_account: v.account,
      p_metric: v.metric,
      p_value: v.value,
      p_observed_on: v.observed_on,
      p_period_start: v.period_start,
      p_period_end: v.period_end,
      p_source: "manual",
      p_evidence: null,
      p_note: v.note,
    }),
  correct: (
    c: Rpc,
    ws: string,
    request: string,
    observation: string,
    value: number,
    reason: string,
  ) =>
    call<Observation>(c, "aura_social_correct_observation", {
      p_workspace: ws,
      p_request: request,
      p_observation: observation,
      p_value: value,
      p_reason: reason,
    }),
  observations: (
    c: Rpc,
    ws: string,
    account: string,
    metric: string | null,
    cursor: unknown,
    limit = 25,
  ) =>
    call<ObservationPage>(c, "aura_social_observations", {
      p_workspace: ws,
      p_account: account,
      p_metric: metric,
      p_limit: limit,
      p_cursor: cursor,
      p_include_superseded: true,
    }),
  recordContent: (
    c: Rpc,
    ws: string,
    v: {
      request: string;
      account: string;
      content: unknown;
      metric: string;
      value: number;
      window: string;
      observed_on: string;
      period_start: string | null;
      period_end: string | null;
      note: string | null;
    },
  ) =>
    call<{
      content: Record<string, unknown>;
      observation: Record<string, unknown>;
    }>(c, "aura_social_record_content_observation", {
      p_workspace: ws,
      p_request: v.request,
      p_account: v.account,
      p_content: v.content,
      p_metric: v.metric,
      p_value: v.value,
      p_window: v.window,
      p_observed_on: v.observed_on,
      p_period_start: v.period_start,
      p_period_end: v.period_end,
      p_source: "manual",
      p_evidence: null,
      p_note: v.note,
    }),
  content: (c: Rpc, ws: string, account: string) =>
    call<ContentRow[]>(c, "aura_social_content", {
      p_workspace: ws,
      p_account: account,
      p_limit: 25,
    }),
  startVerification: (c: Rpc, ws: string, account: string, request: string) =>
    call<Claim>(c, "aura_social_start_verification", {
      p_workspace: ws,
      p_account: account,
      p_request: request,
    }),
  verification: (c: Rpc, ws: string, account: string) =>
    call<Verification>(c, "aura_social_verification", {
      p_workspace: ws,
      p_account: account,
    }),
  submitEvidence: (c: Rpc, ws: string, claim: string, meta: unknown) =>
    call<{ id: string; scan_status: string }>(
      c,
      "aura_social_submit_evidence",
      { p_workspace: ws, p_claim: claim, p_meta: meta },
    ),
  deleteEvidence: (c: Rpc, ws: string, evidence: string) =>
    call<{ storage_path: string }>(c, "aura_social_delete_evidence", {
      p_workspace: ws,
      p_evidence: evidence,
    }),
  requestReview: (c: Rpc, ws: string, claim: string) =>
    call<Claim>(c, "aura_social_request_review", {
      p_workspace: ws,
      p_claim: claim,
    }),
  cancelVerification: (c: Rpc, ws: string, claim: string) =>
    call<Claim>(c, "aura_social_cancel_verification", {
      p_workspace: ws,
      p_claim: claim,
    }),
  setSharing: (c: Rpc, ws: string, id: string, visibility: string) =>
    call<SocialAccountRow>(c, "aura_social_set_sharing", {
      p_workspace: ws,
      p_account: id,
      p_visibility: visibility,
    }),
  grant: (
    c: Rpc,
    ws: string,
    v: {
      account: string;
      recipient: string;
      fields: string[];
      purpose: string;
      valid_until: string | null;
    },
  ) =>
    call<Grant>(c, "aura_social_grant_share", {
      p_workspace: ws,
      p_account: v.account,
      p_recipient: v.recipient,
      p_fields: v.fields,
      p_purpose: v.purpose,
      p_valid_until: v.valid_until,
    }),
  revokeGrant: (c: Rpc, ws: string, grant: string) =>
    call<{ revoked: string }>(c, "aura_social_revoke_share", {
      p_workspace: ws,
      p_grant: grant,
    }),
  shares: (c: Rpc, ws: string, account: string) =>
    call<Grant[]>(c, "aura_social_shares", {
      p_workspace: ws,
      p_account: account,
    }),
  reminders: (c: Rpc, ws: string) =>
    call<Reminders>(c, "aura_social_reminders", { p_workspace: ws }),
  setReminders: (c: Rpc, ws: string, weekly: boolean) =>
    call<{ weekly: boolean; delivery: string }>(
      c,
      "aura_social_set_reminders",
      { p_workspace: ws, p_weekly: weekly },
    ),
  snooze: (c: Rpc, ws: string, account: string, days: number) =>
    call<{ snoozed_until: string }>(c, "aura_social_snooze_reminder", {
      p_workspace: ws,
      p_account: account,
      p_days: days,
    }),
  requestRefresh: (c: Rpc, ws: string, account: string, request: string) =>
    call<Job>(c, "aura_social_request_refresh", {
      p_workspace: ws,
      p_account: account,
      p_request: request,
    }),
  jobs: (c: Rpc, ws: string, account: string) =>
    call<Job[]>(c, "aura_social_jobs", { p_workspace: ws, p_account: account }),
  suggestions: (c: Rpc, ws: string, account: string) =>
    call<
      {
        id: string;
        provider: string;
        fields: unknown;
        uncertainty: unknown;
        status: string;
        created_at: string;
      }[]
    >(c, "aura_social_suggestions", { p_workspace: ws, p_account: account }),
  // Restricted review (Platform Admin + granted reviewer + MFA). The database refuses everyone else.
  reviewQueue: (c: Rpc) => call<QueueItem[]>(c, "aura_social_review_queue", {}),
  reviewClaim: (c: Rpc, claim: string) =>
    call<Record<string, unknown>>(c, "aura_social_review_claim", {
      p_claim: claim,
    }),
  decide: (
    c: Rpc,
    claim: string,
    decision: string,
    reason: string,
    replace: boolean,
  ) =>
    call<Claim>(c, "aura_social_decide", {
      p_claim: claim,
      p_decision: decision,
      p_reason: reason,
      p_replace_existing: replace,
    }),
};
