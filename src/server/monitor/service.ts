import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { classify, type ServiceError } from "@/server/creator/service";
import type { Rollup, Section } from "@/features/monitor/rules";

type Rpc = Pick<SupabaseClient, "rpc">;
export type MResult<T> =
  { ok: true; value: T } | { ok: false; error: ServiceError; message: string };
const friendly = (code: string | undefined, m: string) =>
  /once the deliverable is published/.test(m)
    ? "Record results once the deliverable is published."
    : /future/.test(m)
      ? "Use a date that is not in the future."
      : /predate/.test(m)
        ? "Results cannot be dated before the post was published."
        : /Brand's own records|Brand can use/.test(m)
          ? "Only the Brand can cite its own records as the source."
          : /Name the report/.test(m)
            ? "Name the report (3 to 100 characters)."
            : /side that entered/.test(m)
              ? "Only the side that entered a figure can void it."
              : code === "23514"
                ? "A time window needs both a start and an end date, on or before the observation date."
                : code === "42501"
                  ? "You do not have access to this."
                  : code === "22023"
                    ? "Some of that does not fit. Please check it."
                    : "We could not do that. Nothing was lost, so please try again.";
async function call<T>(
  c: Rpc,
  fn: string,
  args: Record<string, unknown>,
): Promise<MResult<T>> {
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
export type Observation = {
  id: string;
  deliverable_id: string;
  metric: string;
  value: number;
  window_kind: string;
  period_start: string | null;
  period_end: string | null;
  observed_on: string;
  source: string;
  source_note: string | null;
  side: string;
  voided_at: string | null;
  void_reason: string | null;
  mine: boolean;
};
export type ReportRow = {
  id: string;
  name: string;
  version: number;
  sections: Section[];
  from: string | null;
  to: string | null;
  created_at: string;
  author: string;
  withdrawn: boolean;
};
export type ReportFull = {
  id: string;
  blocked: boolean;
  reason?: string;
  name: string;
  version: number;
  sections: Section[];
  from: string | null;
  to: string | null;
  created_at: string;
  snapshot: Rollup & { campaign: { title: string } };
};
export const monitor = {
  overview: (
    c: Rpc,
    ws: string,
    campaign: string,
    from: string | null,
    to: string | null,
  ) =>
    call<Rollup & { campaign: { id: string; title: string; status: string } }>(
      c,
      "aura_monitor_overview",
      { p_workspace: ws, p_campaign: campaign, p_from: from, p_to: to },
    ),
  record: (
    c: Rpc,
    ws: string,
    collab: string,
    deliverable: string,
    f: Record<string, unknown>,
  ) =>
    call<Observation>(c, "aura_monitor_record", {
      p_workspace: ws,
      p_collab: collab,
      p_deliverable: deliverable,
      p_fields: f,
    }),
  void: (c: Rpc, ws: string, id: string, reason: string) =>
    call<{ voided: boolean }>(c, "aura_monitor_void", {
      p_workspace: ws,
      p_observation: id,
      p_reason: reason,
    }),
  observations: (c: Rpc, ws: string, collab: string) =>
    call<Observation[]>(c, "aura_monitor_observations", {
      p_workspace: ws,
      p_collab: collab,
    }),
  creator: (c: Rpc, ws: string, collab: string) =>
    call<Rollup & { shared: boolean; observations: Observation[] }>(
      c,
      "aura_monitor_creator",
      { p_workspace: ws, p_collab: collab },
    ),
  consent: (c: Rpc, ws: string, collab: string, shared: boolean) =>
    call<{ shared: boolean }>(c, "aura_monitor_consent", {
      p_workspace: ws,
      p_collab: collab,
      p_shared: shared,
    }),
  createReport: (
    c: Rpc,
    ws: string,
    campaign: string,
    name: string,
    sections: string[],
    from: string | null,
    to: string | null,
  ) =>
    call<{ id: string; version: number }>(c, "aura_monitor_create_report", {
      p_workspace: ws,
      p_campaign: campaign,
      p_name: name,
      p_sections: sections,
      p_from: from,
      p_to: to,
    }),
  reports: (c: Rpc, ws: string, campaign: string) =>
    call<ReportRow[]>(c, "aura_monitor_reports", {
      p_workspace: ws,
      p_campaign: campaign,
    }),
  report: (
    c: Rpc,
    ws: string,
    id: string,
    action: "view" | "export_csv" | "export_pdf",
  ) =>
    call<ReportFull>(c, "aura_monitor_report", {
      p_workspace: ws,
      p_report: id,
      p_action: action,
    }),
};
