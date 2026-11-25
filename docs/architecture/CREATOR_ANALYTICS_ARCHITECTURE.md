# Creator analytics architecture (M06)

## Principles

- **One observation store.** Account and content observations stay in M05 (`aura_social.account_observation`, `content_observation`, `content_ref`). M06 adds no competing observation or metric table (test-enforced). Only current rows (not superseded) feed analytics; a correction supersedes and keeps the original.
- **Deterministic and labelled.** Every calculation is a fixed rule over recorded numbers. Nothing is called AI. There is no score, rank or rating anywhere (schema and output guard tests).
- **Unknown is not zero.** A missing value is "not recorded"; a stored 0 is a real zero. Comparisons that cannot be made fairly are blocked with the reason and an alternative.

## Layers

| Layer                                                                                                                          | Location                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database (private schema `aura_analytics`, RLS on, no policies, no grants, `SECURITY DEFINER` functions with `search_path=''`) | `supabase/migrations/20261129000100_m06_creator_analytics.sql`                                                                                                             |
| Pure domain rules                                                                                                              | `src/features/creator-analytics/*.ts` (periods, growth, engagement, consolidate, compare, patterns, timing, forecast, experiments, insights, exports, contracts, features) |
| Server                                                                                                                         | `src/server/analytics/service.ts`, `load.ts`; actions in `src/features/creator-analytics/actions.ts`                                                                       |
| UI                                                                                                                             | `/creator/analytics`, `/accounts`, `/content`, `/compare`, `/audience`, `/insights`, `/reports` (+ `/download`), `/creator/experiments`, `/new`, `/[id]`                   |

## What M06 adds to the database

Versioned `metric_semantics` and `derived_def` (extend, not replace, M05's dictionary); `content_timing`; `content_tag` (manual confirmed; AI proposals reviewable only); append-only `audience_snapshot`; `audience_grant`; `insight`; `experiment`, `experiment_link`, `experiment_event`; `cohort_optin`; `export_log`; `competitor_ref` (contract, no writer).

## Period model

Local calendar days in the Creator's stored zone; the database supplies "today". Periods include both ends. The previous period has the same length and ends the day before. A period containing today is flagged as unfinished.

## Net growth rule (point metrics)

Baseline = latest observation on or before the start within a tolerance (`min(14, max(3, days/4))`); otherwise the earliest observation inside the period within the same tolerance. Latest = last observation in the period after the baseline. Real dates are always shown, nothing is interpolated, percentages need a baseline above zero. Previous-period comparison is blocked when either side is unavailable or coverage differs by more than about 40 percent.

## Aggregation rules

Followers: sum only as a platform-account count labelled "includes possible overlap, not unique people". Reach and other unique counts: per account only. Impressions, interactions, profile views, audience growth: summable only over non-overlapping windows inside the period, with coverage stated. Rates: denominator-weighted over accounts that have both inputs, never an average of percentages.

## Experiments

States: draft, planned, active, completed, cancelled. Activation takes a row lock and a per-workspace lock, freezes baseline snapshots, and cannot repeat. Observation links store a snapshot (value, date, window, source) and are validated (same account and metric, after the start, same window as the baseline). Later corrections are shown next to the snapshot and flagged for reassessment but never change the frozen baseline. Results are descriptive medians with no statistical test.

## Sharing and privacy

Audience information is private by default. A grant covers one account, chosen dimensions, one purpose and an optional end date, is Brand-only, and is re-checked on every read and export. Insights, experiments, diagnostics and exports of the Creator have no read path for any other workspace. Cohort benchmarks need opt-in, a minimum of 10 (configurable upwards) and expose only quartiles.

## Not built (contracts only)

Competitor tracking, suspicious-pattern indicators (never fraud verdicts), campaign matching, commercial linking, AI classification, M07/M08 reads. See `src/features/creator-analytics/contracts.ts`.
