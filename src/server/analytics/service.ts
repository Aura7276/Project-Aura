import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { classify, type ServiceError } from "@/server/creator/service";
import type {
  AccountObs,
  ContentItem,
  Series,
} from "@/features/creator-analytics/types";
import type { InsightInput } from "@/features/creator-analytics/insights";

type Rpc = Pick<SupabaseClient, "rpc">;
export type AResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ServiceError; code: string | null; reason: AReason };
export type AReason =
  | "limit"
  | "duplicate"
  | "conflict"
  | "state"
  | "invalid"
  | "window"
  | "generic";
const reasonOf = (code: string | null, message: string): AReason => {
  if (/Too many active/i.test(message)) return "limit";
  if (code === "23505") return "duplicate";
  if (
    /window does not match|before the experiment|already the baseline|does not match this experiment/i.test(
      message,
    )
  )
    return "window";
  if (code === "55000") return "state";
  if (code === "22023" || code === "23514") return "invalid";
  if (code === "40001") return "conflict";
  return "generic";
};
export const reasonText: Record<AReason, string> = {
  limit:
    "You already have the maximum number of active experiments. Finish or cancel one first.",
  duplicate: "That was already added.",
  conflict: "This changed elsewhere. Reload and try again.",
  state: "That is not possible in the experiment's current state.",
  invalid: "Some of that does not fit. Please check it.",
  window:
    "That observation does not match the experiment: it must be the same metric, account and measurement window as the baseline, and recorded after the experiment started.",
  generic:
    "We could not save that. Nothing was lost on this page, so please try again.",
};
async function call<T>(
  c: Rpc,
  fn: string,
  args: Record<string, unknown>,
): Promise<AResult<T>> {
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
export type Insight = {
  id: string;
  fingerprint: string;
  category: string;
  rule_key: string;
  rule_version: number;
  priority: number;
  title: string;
  explanation: string;
  evidence: Record<string, unknown>;
  limitations: string[];
  action: string | null;
  link: string | null;
  generated_at: string;
  status: string;
  status_at: string;
};
export type Snapshot = {
  ref: string;
  kind: string;
  metric: string;
  value: number;
  observed_on: string;
  period_start: string | null;
  period_end: string | null;
  window_days: number | null;
  window_kind?: string | null;
  source: string;
  corrected?: boolean;
  content_id?: string;
};
export type Experiment = {
  id: string;
  account_id: string;
  platform: string;
  handle: string;
  name: string;
  hypothesis: string;
  objective: string | null;
  metric: string;
  metric_scope: "account" | "content";
  planned_change: string | null;
  measurement_method: string | null;
  success_criterion: string | null;
  confounders: string | null;
  evaluation_days: number;
  template_key: string | null;
  baseline_refs: string[];
  baseline_unavailable_reason: string | null;
  status: "draft" | "planned" | "active" | "completed" | "cancelled";
  baseline: {
    observations: Snapshot[];
    unavailable_reason: string | null;
    frozen_at: string;
  } | null;
  activated_at: string | null;
  ended_at: string | null;
  outcome: string | null;
  interpretation: string | null;
  next_experiment: string | null;
  learning_tags: string[];
  created_at: string;
  updated_at: string;
  links: {
    id: string;
    kind: string;
    ref_id: string;
    snapshot: Snapshot;
    linked_at: string;
    current: { value: number; corrected_since: boolean } | null;
  }[];
  events: { event: string; at: string; detail: unknown }[];
};
export type AudienceSnapshot = {
  id: string;
  account_id: string;
  dimension: string;
  buckets: { bucket: string; share: number }[];
  observed_on: string;
  period_start: string | null;
  period_end: string | null;
  denominator_kind: string;
  denominator: number | null;
  coverage_pct: number | null;
  source: string;
  note: string | null;
  supersedes: string | null;
  entered_at: string;
};
export type AudienceGrant = {
  id: string;
  account_id: string;
  recipient: string;
  dimensions: string[];
  purpose: string;
  valid_until: string | null;
  status: "active" | "revoked";
  created_at: string;
};
export type Cohort = {
  available: boolean;
  reason?: string;
  minimum?: number;
  band?: string;
  platform?: string;
  metric?: string;
  p25?: number;
  median?: number;
  p75?: number;
  cohort_size_at_least?: number;
  limits?: string[];
};
export type Overview = {
  open_insights: number;
  new_insights: number;
  active_experiments: number;
  experiments: { id: string; name: string; status: string }[];
};

export const analytics = {
  series: (c: Rpc, ws: string, from: string, to: string) =>
    call<Series>(c, "aura_analytics_account_series", {
      p_workspace: ws,
      p_from: from,
      p_to: to,
      p_lookback: 120,
    }),
  content: (c: Rpc, ws: string, account: string | null) =>
    call<{ content: ContentItem[] }>(c, "aura_analytics_content", {
      p_workspace: ws,
      p_account: account,
    }),
  overview: (c: Rpc, ws: string) =>
    call<Overview>(c, "aura_analytics_overview", { p_workspace: ws }),
  setTag: (c: Rpc, ws: string, content: string, kind: string, value: string) =>
    call<Record<string, unknown>>(c, "aura_analytics_set_tag", {
      p_workspace: ws,
      p_content: content,
      p_kind: kind,
      p_value: value,
    }),
  removeTag: (c: Rpc, ws: string, tag: string) =>
    call<Record<string, unknown>>(c, "aura_analytics_remove_tag", {
      p_workspace: ws,
      p_tag: tag,
    }),
  reviewTag: (
    c: Rpc,
    ws: string,
    tag: string,
    action: string,
    value: string | null,
  ) =>
    call<Record<string, unknown>>(c, "aura_analytics_review_tag", {
      p_workspace: ws,
      p_tag: tag,
      p_action: action,
      p_value: value,
    }),
  setTiming: (c: Rpc, ws: string, content: string, at: string, tz: string) =>
    call<Record<string, unknown>>(c, "aura_analytics_set_timing", {
      p_workspace: ws,
      p_content: content,
      p_published_at: at,
      p_tz: tz,
    }),
  audience: (c: Rpc, ws: string) =>
    call<{ snapshots: AudienceSnapshot[] }>(c, "aura_analytics_audience", {
      p_workspace: ws,
      p_account: null,
    }),
  recordAudience: (
    c: Rpc,
    ws: string,
    v: {
      request: string;
      account: string;
      dimension: string;
      buckets: { bucket: string; share: number }[];
      observed_on: string;
      period_start: string | null;
      period_end: string | null;
      denominator_kind: string;
      denominator: number | null;
      coverage: number | null;
      note: string | null;
    },
  ) =>
    call<AudienceSnapshot>(c, "aura_analytics_record_audience", {
      p_workspace: ws,
      p_request: v.request,
      p_account: v.account,
      p_dimension: v.dimension,
      p_buckets: v.buckets,
      p_observed_on: v.observed_on,
      p_period_start: v.period_start,
      p_period_end: v.period_end,
      p_denominator_kind: v.denominator_kind,
      p_denominator: v.denominator,
      p_coverage: v.coverage,
      p_note: v.note,
    }),
  grants: (c: Rpc, ws: string) =>
    call<AudienceGrant[]>(c, "aura_analytics_audience_grants", {
      p_workspace: ws,
    }),
  grant: (
    c: Rpc,
    ws: string,
    v: {
      account: string;
      recipient: string;
      dimensions: string[];
      purpose: string;
      valid_until: string | null;
    },
  ) =>
    call<AudienceGrant>(c, "aura_analytics_grant_audience", {
      p_workspace: ws,
      p_account: v.account,
      p_recipient: v.recipient,
      p_dimensions: v.dimensions,
      p_purpose: v.purpose,
      p_valid_until: v.valid_until,
    }),
  revokeGrant: (c: Rpc, ws: string, grant: string) =>
    call<{ revoked: string }>(c, "aura_analytics_revoke_audience", {
      p_workspace: ws,
      p_grant: grant,
    }),
  cohortOptin: (c: Rpc, ws: string, on: boolean) =>
    call<{ enabled: boolean }>(c, "aura_analytics_cohort_optin", {
      p_workspace: ws,
      p_enabled: on,
    }),
  cohort: (c: Rpc, ws: string, platform: string, today: string) =>
    call<Cohort>(c, "aura_analytics_cohort_benchmark", {
      p_workspace: ws,
      p_platform: platform,
      p_today: today,
    }),
  syncInsights: (
    c: Rpc,
    ws: string,
    items: InsightInput[],
    rules: readonly string[],
  ) =>
    call<{ created: number; regenerated: number; marked_stale: number }>(
      c,
      "aura_analytics_sync_insights",
      { p_workspace: ws, p_items: items, p_rules: rules },
    ),
  insights: (c: Rpc, ws: string, stale = false) =>
    call<Insight[]>(c, "aura_analytics_insights", {
      p_workspace: ws,
      p_include_stale: stale,
    }),
  insightStatus: (c: Rpc, ws: string, id: string, status: string) =>
    call<Insight>(c, "aura_analytics_insight_status", {
      p_workspace: ws,
      p_insight: id,
      p_status: status,
    }),
  experiments: (c: Rpc, ws: string, id: string | null = null) =>
    call<Experiment[]>(c, "aura_analytics_experiments", {
      p_workspace: ws,
      p_id: id,
    }),
  createExperiment: (
    c: Rpc,
    ws: string,
    request: string,
    account: string,
    exp: Record<string, unknown>,
  ) =>
    call<Experiment>(c, "aura_analytics_create_experiment", {
      p_workspace: ws,
      p_request: request,
      p_account: account,
      p_exp: exp,
    }),
  updateExperiment: (
    c: Rpc,
    ws: string,
    id: string,
    exp: Record<string, unknown>,
  ) =>
    call<Experiment>(c, "aura_analytics_update_experiment", {
      p_workspace: ws,
      p_id: id,
      p_exp: exp,
    }),
  planExperiment: (c: Rpc, ws: string, id: string) =>
    call<Experiment>(c, "aura_analytics_plan_experiment", {
      p_workspace: ws,
      p_id: id,
    }),
  activateExperiment: (c: Rpc, ws: string, id: string) =>
    call<Experiment>(c, "aura_analytics_activate_experiment", {
      p_workspace: ws,
      p_id: id,
    }),
  link: (c: Rpc, ws: string, id: string, ref: string) =>
    call<Record<string, unknown>>(c, "aura_analytics_link_observation", {
      p_workspace: ws,
      p_id: id,
      p_ref: ref,
    }),
  unlink: (c: Rpc, ws: string, link: string) =>
    call<Record<string, unknown>>(c, "aura_analytics_unlink_observation", {
      p_workspace: ws,
      p_link: link,
    }),
  finish: (
    c: Rpc,
    ws: string,
    id: string,
    action: "complete" | "cancel",
    v: {
      outcome?: string | null;
      interpretation?: string | null;
      next?: string | null;
      tags?: string[];
    } = {},
  ) =>
    call<Experiment>(c, "aura_analytics_finish_experiment", {
      p_workspace: ws,
      p_id: id,
      p_action: action,
      p_outcome: v.outcome ?? null,
      p_interpretation: v.interpretation ?? null,
      p_next: v.next ?? null,
      p_tags: v.tags ?? [],
    }),
  authorizeExport: (
    c: Rpc,
    ws: string,
    kind: string,
    format: string,
    purpose: string,
  ) =>
    call<{ id: string; authorized_at: string }>(
      c,
      "aura_analytics_authorize_export",
      { p_workspace: ws, p_kind: kind, p_format: format, p_purpose: purpose },
    ),
  exports: (c: Rpc, ws: string) =>
    call<
      {
        id: string;
        kind: string;
        format: string;
        purpose: string;
        at: string;
      }[]
    >(c, "aura_analytics_exports", { p_workspace: ws }),
};
export type { AccountObs };
