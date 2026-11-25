# M04 Creator dashboard: completion report

Branch `feature/m04-creator-dashboard`, based on `feature/m03-creator-onboarding` at `dbf750b` (M03), which sits on `feature/m02-authentication` `471c4d6` (M02) and M01 `cbb1aa3`. `main` is `14aab75`. **Not merged. Not pushed.**

## 1. Summary

M04 is implemented and verified at the database, unit and component level. The authenticated Creator Studio (layout, navigation, dashboard, daily actions, goal tracking, weekly review, recommendations, preferences, search, notifications, walkthrough, quick create, assistant entry point) exists and passes its tests. **It is not accepted.** There was no live Supabase project, so Auth, PostgREST and Storage were never exercised, and no real authenticated session ever rendered the real routes. The browser tests run on a development preview that uses the same components, views and rule engine with illustrative data. Owner acceptance is not recorded.

## 2. Baseline and defects carried forward

- **M02 migration defect (unchanged, still open):** `20261125000100_m02_identity.sql` ends a function with `end $;` and cannot be applied. Tests apply a patched copy. M02's branch needs the one-character fix.
- Files outside M04 touched: M03 `integration.ts` (`m04DashboardEntry` is now `/creator/dashboard`), M03 completion page (links to Creator Studio) and M03 `service.ts` (`creatorContext` also returns the workspace name). No migration or table of M02 or M03 was altered.
- Toolchain: Node 22.23.5 here; the repository pins Node 24.
- Concurrent development: only `main`, the M01, M02 branches exist remotely. No other agent was active. No migration conflicts (`20261127000100`).

## 3. Requirements

| ID  | Status      | Note                                                                                                                                    |
| --- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| F01 | Tested      | Access needs only M03 activation, never followers. Standard rule explained, not enforced as a gate.                                     |
| F02 | In progress | Growth-first ordering tested in every situation. **Opportunity data Blocked on M10**: honest empty state with preparation actions.      |
| F03 | Tested      | Five areas, typed config, active indicator, planned states, no dead links.                                                              |
| F04 | Tested      | Bottom bar, drawer with focus trap and focus return, safe-area padding.                                                                 |
| F05 | Tested      | Four account situations plus UGC focus, from real M03 data. Activity-based personalization is limited to action rotation and staleness. |
| F06 | Tested      | 3 to 5 actions, idempotent, persisted, states, time zone from stored preference.                                                        |
| F07 | In progress | Persistent entry point with workspace and page context and an honest unavailable state. **Assistant itself Blocked on M07.**            |
| F08 | Tested      | Real-event milestones, transparent streak, switch-off, no leaderboards. Milestone definitions are proposals.                            |
| F09 | In progress | Weekly in-app review tested. Digest is a stored preference only. **Delivery Blocked on M25.**                                           |
| F10 | Tested      | Observations append-only, baseline never invented, zero versus unknown, stale, self-reported, evidence-based insights.                  |
| F11 | In progress | Seven eligibility explanations tested. **Campaign recommendations Blocked on M10.**                                                     |
| F12 | In progress | Idea capture, idea list and honest readiness for upcoming content and calendar. **Content and calendar Blocked on M08.**                |
| F13 | In progress | Component with distinct unavailable, none and records states. **Amounts Blocked on M13.** Nothing is invented.                          |
| F14 | In progress | Real idea capture and progress recording, goal editing via M03 form. **Portfolio Blocked on M09** (disabled with reason).               |
| F15 | Tested      | Offered not forced, skippable anywhere and by Escape, repeatable, state stored.                                                         |
| F16 | Tested      | No-account dashboard asserts no fabricated numbers. Unavailable metrics are labelled.                                                   |
| F17 | In progress | Own ideas, actions, plan, goals, notes, tools, guides. **Campaigns (M10) and collaborations (M12) Blocked**: reported as not searched.  |
| F18 | Tested      | Nine widgets, per workspace and user, reset. Advanced layout deferred as specified.                                                     |

## 4. Acceptance criteria

See [M04_ACCEPTANCE.md](../acceptance/M04_ACCEPTANCE.md).

## 5. Screen and route inventory

`/creator` (redirect), `/creator/dashboard`, `/creator/actions`, `/creator/progress`, `/creator/recommendations`, `/creator/grow`, `/creator/create`, `/creator/studio`, `/creator/search`, `/creator/notifications`, `/creator/settings/dashboard`; overlays: drawer, quick create, assistant, walkthrough; `loading.tsx` skeleton and `error.tsx` (shows no detail). Dev only: `/dev/studio-preview/*`.

## 6 to 12. Behaviour

See [CREATOR_STUDIO_ARCHITECTURE.md](../architecture/CREATOR_STUDIO_ARCHITECTURE.md): navigation (section 3), personalization (4), daily actions (5), goals (6), milestones (7), weekly review (8), search (9), assistant, notifications, commercial, walkthrough and preferences (10).

## 13. Database

One additive migration, `20261127000100_m04_creator_dashboard.sql`: schema `aura_studio` with 6 tables (`dashboard_pref`, `daily_action`, `goal_observation`, `idea`, `milestone_event`, `weekly_review`), RLS enabled on all, no policies, no grants, and 14 `SECURITY DEFINER` functions pinning an empty `search_path`. No M02 or M03 definition altered. No search table: search is a function over existing tables.

## 14. Supabase connectivity

**None.** No credentials or project were available. `supabase:check` was not run.

## 15. RLS and tenant isolation

Denied with the correct SQLSTATE on every function: anonymous, direct table access, private helper, unactivated Creator (`55000`), other Creator, random or null workspace id, Brand, Agency, non-owner member. Inspected: RLS on all 6 tables, zero grants, zero policies, exactly 14 executable functions, none for anon, all pin `search_path`. Search isolation: another tenant's idea, action and plan text return an empty array with no count or snippet; wildcards are literal.

## 16. Test counts

- Unit and database: **109 passed, 0 skipped** (9 files). New in M04: 36 domain tests and 8 database tests.
- SQL scenario groups: **18 passed**.
- Concurrency (real, separate connections): simultaneous first-load generation yields one set of 3 and both callers see it; duplicate observation submits create one row; conflicting status changes serialize.
- Browser: **135 passed, 0 skipped** on the final full run (49 M01/M02, 30 M03, 56 M04), together with the final full gate run: frozen install, format, ESLint (0 problems), strict TypeScript, Vitest (109), production build and `pnpm audit` (no known vulnerabilities).
- Real-database tests ran with `AURA_TEST_DB=1`; without it they are reported as skipped and not counted as passed.
- Defects found by the tests and fixed: completed actions were counted by assigned week in the weekly review (now by completion week, no double counting); `weekly` recomputed stored weeks on every call (8.5 to 1.8 ms); a Server-to-Client function prop crashed the preview; the active-area indicator required an exact path; UGC-focused Creators did not get UGC preparation in their top actions; in-text links relied on colour alone (axe); form labels on the dark card were invisible (not caught by axe, caught by review, now covered by an explicit contrast test); account-menu accessible name mismatch (axe).

## 17. Build

`pnpm build` passed. Format, lint (0 problems), strict typecheck passed. `pnpm audit`: no known vulnerabilities. Secret scan was a pattern search only (gitleaks not installed): one hit, a deliberate fake string in an existing M01 test.

## 18. Performance and accessibility

**Conditions:** local PostgreSQL 16 on the same host as the test runner, an almost empty database, 300 sequential calls per function inside one session, `authenticated` role, no network, no connection pool, no Supabase. These are database-function latencies, not page-load times.

| Function                                            | ms per call  |
| --------------------------------------------------- | ------------ |
| context, actions (14d), observations, ideas, search | 0.17 to 0.21 |
| ensure actions (existing day, idempotent path)      | 0.33         |
| milestones (includes streak)                        | 0.43         |
| weekly (after fix; current week is computed live)   | 1.76         |
| M03 state (for reference)                           | 0.28         |

Client JavaScript for the dashboard route (production build, gzip): 4 route chunks, 23.3 KB, as listed in the route's client reference manifest. This **excludes shared framework chunks**, so it is not total page weight, and it is **not comparable** with public marketing pages, which were measured by the same method but have different content and no authentication. No real authenticated page-load, LCP or INP was measured because no authenticated session was possible. The dashboard issues about 7 sequential database round trips; at a few milliseconds each on a hosted database that is the main cost to measure live.

**Accessibility (automated and manual review):** axe (WCAG 2.0 and 2.1 A and AA) found no violations on all seven page types at 390 and 1440 px, on all four dashboard situations, and with the drawer, quick create, assistant and tour open. No horizontal overflow at 320, 360, 390, 430, 768, 1024, 1440 and 1920 px. Keyboard: skip link, drawer focus trap and return, Escape on every overlay, tour steppable by keyboard. Reduced motion verified by computed style. Fixed bars never cover content or focused fields. **Not done:** screen-reader testing with real assistive technology; axe cannot validate meaning (it missed the invisible labels), so a human pass is still required.

## 19. Screenshots

`docs/development/evidence/m04/`: dashboard (three situations), actions, progress, recommendations, create at 390, 768 and 1440 px, plus drawer, quick create, assistant and walkthrough at 390 px. They show development preview data, not a real Creator.

## 20. Outstanding dependencies

Live Supabase project and Auth. M05 (verification, refresh). M06 (analytics observations). M07 (assistant provider). M08 (content and calendar). M09 (portfolio, publication). M10 and M11 (opportunities, requirements). M12 (deliverables). M13 (commercial records). M25 (notifications, digest). Edge or WAF rate limiting (current limiter is per instance).

## 21. Unresolved business decisions

1. Milestone definitions and whether any streak copy is acceptable.
2. Daily-action rules and priorities (proposed here).
3. Stale threshold (14 days) and action rotation window (3 days).
4. Weekly boundary (Monday start) and the 12-week generation cap.
5. Default time zone (Asia/Kolkata) and the 14 offered zones.
6. Digest content and cadence once M25 exists.
7. AI limits for the assistant.
8. Search scope once campaigns and collaborations exist, and any indexing approach.
9. Retention and deletion of observations, ideas and reviews.

## 22. Manual acceptance checklist

See M04_ACCEPTANCE.md.

## 23. Git

Branch `feature/m04-creator-dashboard`, local commit only. No push, no merge, no PR.

## 24. M05 readiness

M05 can extend `aura_creator.social_account`, widen `goal_observation.source` and `social_account.verification`, and reuse `evaluateEligibility`. The Grow area already links to the self-reported accounts form and reserves the analytics and verification slots. M05 was not started.
