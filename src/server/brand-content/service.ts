import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { classify, type ServiceError } from "@/server/creator/service";

type Rpc = Pick<SupabaseClient, "rpc">;
export type BCResult<T> =
  { ok: true; value: T } | { ok: false; error: ServiceError; message: string };
/** Database messages written for people are passed through; anything else becomes a calm, generic message. */
const friendly = (code: string | undefined, m: string) => {
  const own = [
    /^Not allowed: .+/,
    /Someone else saved a newer version/,
    /Only approved content can be scheduled/,
    /Choose an account and a date before scheduling/,
    /Add a hook, script or caption before review/,
    /Say what needs to change/,
    /Some claims are not on your approved list/,
    /Send it for review first/,
    /Only the approved version can be published/,
    /Choose the account it was posted on/,
    /Add the full https:\/\/ link/,
    /Choose the date it went live/,
    /Complete the publication checklist first/,
    /The checklist opens once the content is approved/,
    /This item can no longer be edited/,
    /Published items cannot be moved/,
    /The agreed rights do not cover that account/,
    /Results can be recorded once it is published/,
    /The reading date must be between publication and today/,
    /Say which agreement allows this Creator asset/,
    /You can have up to \d+ active pillars/,
    /Restore it first/,
    /Choose one of your accounts/,
  ].find((r) => r.test(m));
  if (own) return m.replace(/%%/g, "%");
  if (/more than 100/.test(m))
    return "Your content mix adds up to more than 100%. Lower another pillar first.";
  if (code === "42501")
    return "You need to be an owner or admin of this Brand, signed in with your authenticator.";
  if (code === "40001")
    return "Someone else saved a newer version. Reload to see it.";
  if (code === "22023" || code === "23514" || code === "23505")
    return "Some of that does not fit. Please check it.";
  return "We could not do that. Nothing was lost, so please try again.";
};
async function call<T>(
  c: Rpc,
  fn: string,
  args: Record<string, unknown>,
): Promise<BCResult<T>> {
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

export type Stage =
  | "idea"
  | "drafting"
  | "production"
  | "in_review"
  | "approved"
  | "scheduled"
  | "published"
  | "archived";
export type Format =
  | "reel"
  | "short"
  | "carousel"
  | "story"
  | "post"
  | "video"
  | "live"
  | "article";
export type Account = {
  id: string;
  platform: string;
  handle: string;
  followers?: number | null;
  observed_on?: string | null;
  source?: string;
};
export type Rights = {
  allowed: boolean;
  reason: string;
  until?: string;
  channels?: string[];
};
export type Item = {
  id: string;
  title: string;
  format: Format;
  stage: Stage;
  version: number;
  approved_version: number | null;
  approved_current: boolean;
  approved_at: string | null;
  account_id: string | null;
  pillar_id: string | null;
  segment_id: string | null;
  product_id: string | null;
  account: { platform: string; handle: string } | null;
  pillar: string | null;
  segment: { name: string; basis: string } | null;
  product: string | null;
  hook: string | null;
  script?: string | null;
  caption: string | null;
  cta: string | null;
  disclosure: string | null;
  notes: string | null;
  claims: string[];
  unapproved_claims: string[];
  planned_for: string | null;
  checklist?: Record<string, { at: string }>;
  checklist_required: string[];
  published_url: string | null;
  published_on: string | null;
  source: "team" | "ai" | "repurposed";
  repurpose: {
    creator: string;
    url: string | null;
    published_on: string;
    usage_months: number;
    channels: string[];
    allowed_until: string;
    collaboration_id: string;
  } | null;
  created_at: string;
  updated_at: string;
};
export type Detail = Item & {
  reviews: {
    version: number;
    decision: "approved" | "changes_requested" | "submitted" | "reopened";
    note: string | null;
    unapproved_claims: string[];
    by: string;
    at: string;
  }[];
  revisions: { version: number; by: string; at: string }[];
  assets: {
    id: string;
    title: string;
    kind: string;
    url: string;
    provenance: string;
    rights_note: string | null;
    created_at: string;
  }[];
  results: {
    id: string;
    metric: string;
    value: number;
    observed_on: string;
    source: string;
    note: string | null;
    by: string;
    voided: boolean;
    void_reason: string | null;
  }[];
  rights_now: Rights | null;
};
export type MetricDef = {
  label: string;
  definition: string;
  not_unique?: boolean;
};
export type Overview = {
  items: Item[];
  archived: number;
  pillars: {
    id: string;
    name: string;
    description: string | null;
    mix: number;
    planned: number;
    published: number;
  }[];
  accounts: Account[];
  segments: { id: string; name: string; basis: string }[];
  products: { id: string; name: string; claims: string[] }[];
  guidelines: {
    tone: string[] | null;
    voice: string | null;
    dos: string[] | null;
    donts: string[] | null;
    claims_rules: string | null;
    disclosures: string | null;
  } | null;
  objective: string | null;
  period: { from: string; to: string };
  metrics: Record<string, MetricDef>;
};
export type Source = {
  collaboration_id: string;
  deliverable_id: string;
  creator: string;
  title: string;
  url: string | null;
  published_on: string;
  campaign: string | null;
  rights: {
    usage_months?: number;
    channels?: string[];
    exclusivity_days?: number;
  } | null;
  accounts: (Account & { check: Rights })[];
};
export type Learning = {
  published: number;
  with_results: number;
  by_metric: Record<string, { total: number; items: number }>;
  by_pillar: {
    pillar: string;
    published: number;
    with_results: number;
    average: Record<string, number>;
  }[];
  by_format: {
    format: Format;
    published: number;
    with_results: number;
    average: Record<string, number>;
  }[];
  top: {
    id: string;
    title: string;
    format: Format;
    published_on: string;
    published_url: string;
    value: number;
    metric: string;
    observed_on: string;
    source: string;
  }[];
  metrics: Record<string, MetricDef>;
};

export const brandContent = {
  overview: (
    c: Rpc,
    ws: string,
    from: string | null = null,
    to: string | null = null,
  ) =>
    call<Overview>(c, "aura_brand_content_overview", {
      p_workspace: ws,
      p_from: from,
      p_to: to,
    }),
  item: (c: Rpc, ws: string, id: string) =>
    call<Detail>(c, "aura_brand_content_item", { p_workspace: ws, p_item: id }),
  revision: (c: Rpc, ws: string, id: string, version: number) =>
    call<Record<string, unknown>>(c, "aura_brand_content_revision", {
      p_workspace: ws,
      p_item: id,
      p_version: version,
    }),
  create: (
    c: Rpc,
    ws: string,
    request: string,
    fields: Record<string, unknown>,
  ) =>
    call<{ id: string }>(c, "aura_brand_content_create", {
      p_workspace: ws,
      p_request: request,
      p_fields: fields,
    }),
  save: (
    c: Rpc,
    ws: string,
    id: string,
    expected: number,
    fields: Record<string, unknown>,
  ) =>
    call<{ version: number; changed: boolean; reopened: boolean }>(
      c,
      "aura_brand_content_save",
      { p_workspace: ws, p_item: id, p_expected: expected, p_fields: fields },
    ),
  move: (c: Rpc, ws: string, id: string, to: Stage) =>
    call<{ stage: Stage }>(c, "aura_brand_content_move", {
      p_workspace: ws,
      p_item: id,
      p_to: to,
    }),
  review: (
    c: Rpc,
    ws: string,
    id: string,
    version: number,
    decision: "approved" | "changes_requested",
    note: string | null,
  ) =>
    call<{ stage: Stage }>(c, "aura_brand_content_review", {
      p_workspace: ws,
      p_item: id,
      p_version: version,
      p_decision: decision,
      p_note: note,
    }),
  check: (c: Rpc, ws: string, id: string, key: string, done: boolean) =>
    call<Record<string, unknown>>(c, "aura_brand_content_check", {
      p_workspace: ws,
      p_item: id,
      p_key: key,
      p_done: done,
    }),
  publish: (c: Rpc, ws: string, id: string, url: string, on: string) =>
    call<{ stage: Stage }>(c, "aura_brand_content_publish", {
      p_workspace: ws,
      p_item: id,
      p_url: url,
      p_on: on,
    }),
  savePillar: (
    c: Rpc,
    ws: string,
    id: string | null,
    name: string,
    description: string | null,
    mix: number,
    archived = false,
  ) =>
    call<{ id: string; mix_total: number }>(
      c,
      "aura_brand_content_save_pillar",
      {
        p_workspace: ws,
        p_id: id,
        p_name: name,
        p_description: description,
        p_mix: mix,
        p_archived: archived,
      },
    ),
  sources: (c: Rpc, ws: string) =>
    call<Source[]>(c, "aura_brand_content_sources", { p_workspace: ws }),
  repurpose: (
    c: Rpc,
    ws: string,
    request: string,
    collab: string,
    deliverable: string,
    account: string,
    planned: string | null,
  ) =>
    call<{ id: string; until: string }>(c, "aura_brand_content_repurpose", {
      p_workspace: ws,
      p_request: request,
      p_collab: collab,
      p_deliverable: deliverable,
      p_account: account,
      p_planned: planned,
    }),
  addAsset: (
    c: Rpc,
    ws: string,
    item: string | null,
    fields: Record<string, unknown>,
  ) =>
    call<{ id: string }>(c, "aura_brand_content_add_asset", {
      p_workspace: ws,
      p_item: item,
      p_fields: fields,
    }),
  removeAsset: (c: Rpc, ws: string, id: string) =>
    call<{ removed: boolean }>(c, "aura_brand_content_remove_asset", {
      p_workspace: ws,
      p_asset: id,
    }),
  record: (
    c: Rpc,
    ws: string,
    item: string,
    metric: string,
    value: number,
    observed: string,
    source: string,
    note: string | null,
  ) =>
    call<{ id: string }>(c, "aura_brand_content_record", {
      p_workspace: ws,
      p_item: item,
      p_metric: metric,
      p_value: value,
      p_observed: observed,
      p_source: source,
      p_note: note,
    }),
  void: (c: Rpc, ws: string, id: string, reason: string) =>
    call<{ voided: boolean }>(c, "aura_brand_content_void", {
      p_workspace: ws,
      p_result: id,
      p_reason: reason,
    }),
  learning: (c: Rpc, ws: string) =>
    call<Learning>(c, "aura_brand_content_learning", { p_workspace: ws }),
};
