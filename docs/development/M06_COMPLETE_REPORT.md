# M06 complete report: Creator analytics and Growth Experiment Lab

Branch `feature/m06-creator-analytics` (built on M05 `616e418`). Committed locally. **Not pushed, not merged**: GitHub refuses this environment with 403 until the Claude GitHub App is installed on the repository. M07 not started.

## Scope note

The owner's M06 brief arrived truncated inside section 32 ("Peer benchmarking ... Requirements:"). Sections 1 to 32 were implemented as far as independently executable. Anything after section 32 was not received and is not implemented; the owner should resend it.

## Delivered

- Migration `20261129000100_m06_creator_analytics.sql`: private schema `aura_analytics`, 14 tables, 29 public functions, versioned metric semantics and derived calculations, tags and timing, append-only audience snapshots, insights with regeneration and outdated labelling, experiments with frozen baselines and validated links, cohort opt-in with suppression, audience grants, export log, M04 widget allowlist extended. No competing observation or metric table.
- Pure domain rules in `src/features/creator-analytics/`: periods, net growth, interval totals, engagement, consolidation, content comparison, patterns, publishing time, scenario ranges, experiments, rule-based insights and diagnostics, CSV and PDF writers (no new dependency), contracts, feature tiers.
- Server layer `src/server/analytics/`, server actions, 10 routes plus a download route, M04 integration (nav items Analytics and Experiments, dashboard widget, search through nav).
- Cross-module fix: `src/lib/use-idempotent-form.ts`. React 19 cleared typed input after a failed validation; M04, M05 and M06 forms now keep it. Found by the M06 stack test.

## Verification (this environment)

| Gate                                                                       | Result                                                                                                                                                                  |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prettier check                                                             | clean                                                                                                                                                                   |
| ESLint                                                                     | 0 problems                                                                                                                                                              |
| Typecheck                                                                  | clean                                                                                                                                                                   |
| Vitest with `AURA_TEST_DB=1` (local PostgreSQL 16, auth and storage stubs) | 13 files, 211 passed, 0 skipped                                                                                                                                         |
| of which M06                                                               | 44 domain tests; 14 DB tests including 12 SQL scenario groups, M03/M04/M05 suites re-run on the M06 schema, RLS and grant inspection, drift checks, 5 concurrency tests |
| Playwright browser suite (preview and production)                          | 135 passed                                                                                                                                                              |
| Stack suite (real routes, local stand-in for Supabase)                     | 20 passed (5 of them M06, including axe and overflow at 320, 768, 1280 on 9 pages)                                                                                      |
| Production build                                                           | compiled                                                                                                                                                                |
| `pnpm audit --prod`                                                        | no known vulnerabilities                                                                                                                                                |

Not verified: live Supabase, real provider data, AI (none exists), real peer cohorts (synthetic fixtures only), Brand-side screens.

## Not done or partial

Integration with M04 daily actions, weekly review and own-experiment search (needs M04 schema coordination). Goal-progress charts stay in M04 Progress rather than being duplicated. Commercial linking, competitor tracking, suspicious-pattern indicators, campaign matching and AI classification are contracts only. Feature tiers are marked but not enforced (M27). Insights regenerate when the insights page opens (no scheduler). A Brand-side export route exists only in the database.

## Proposed defaults needing owner approval

See the M06 section of `DECISION_REGISTER.md`: baseline tolerance, coverage threshold for period comparison, pattern sample minimums, timing confidence labels, forecast thresholds (8 observations, 56 days, gap 21), 3 active experiments, cohort minimum (floor 10, default 25), retention.
