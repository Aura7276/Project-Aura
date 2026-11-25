// Shapes returned by the M06/M05 database functions. Observations come from aura_social (M05); M06 adds no competing observation store.
export type Source =
  "manual" | "screenshot_supported" | "ai_confirmed" | "provider";
export type AccountObs = {
  id: string;
  account_id: string;
  metric: string;
  value: number;
  observed_on: string;
  period_start: string | null;
  period_end: string | null;
  source: Source;
  has_evidence: boolean;
  corrected: boolean;
  entered_at: string;
};
export type AccountRef = {
  id: string;
  platform: string;
  handle: string;
  display_name: string | null;
  lifecycle: string;
  connection: string;
  history_stale_since: string | null;
  is_primary: boolean;
};
export type Tag = {
  id: string;
  kind: string;
  value: string;
  source: string;
  status: string;
  uncertainty: unknown;
};
export type ContentObs = {
  id: string;
  metric: string;
  value: number;
  window_kind: "lifetime" | "window";
  period_start: string | null;
  period_end: string | null;
  observed_on: string;
  source: Source;
  corrected: boolean;
  has_evidence: boolean;
};
export type ContentItem = {
  id: string;
  account_id: string;
  platform: string;
  handle: string;
  external_id: string;
  url: string | null;
  title: string | null;
  format: string | null;
  published_on: string | null;
  published_at: string | null;
  tz: string | null;
  tags: Tag[];
  observations: ContentObs[];
};
export type Series = { accounts: AccountRef[]; observations: AccountObs[] };
/** Every analytic value says what it is. Unknown is never zero. */
export type ValueState =
  "value" | "actual_zero" | "missing" | "unknown" | "unavailable" | "stale";
export const sourceLabel: Record<Source, string> = {
  manual: "Self-reported",
  screenshot_supported: "Screenshot-supported (self-reported)",
  ai_confirmed: "AI-extracted, confirmed by you",
  provider: "Provider-derived",
};
