# M04 acceptance

Owner acceptance is **not** recorded. This is evidence for the owner's manual review.

Legend: **DB** = real PostgreSQL 16 with the actual M02 (patched copy), M03 and M04 migrations and an `auth` stub. **Unit** = Vitest. **Browser** = Playwright on the development preview (real components, real views and rule engine, illustrative data, no persistence) or on real anonymous routes. **Live Supabase** = not executed.

| ID       | Criterion                                                                                      | Evidence                                                                                                                                                                                                                                                                                                        | Result                                                                          |
| -------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| M04-AC01 | A Creator without an account sees an actionable dashboard without fake metrics                 | Browser: aspiring dashboard shows 3 to 5 actions, plan, "no audience numbers because none exist" and no currency, wallet, percentage or follower figures in the main text. Unit: `no_accounts` ordering, actions with no data.                                                                                  | Passed (preview). Live session pending.                                         |
| M04-AC02 | Navigation works on desktop and mobile; the assistant respects workspace context               | Browser: five areas, active indicator, planned items not links, no dead links, bottom bar and drawer (focus trap, Escape, focus return), drawer opens quick create and assistant, fixed bars never cover content. Assistant dialog shows the workspace and page, has no text input, states it is unavailable.   | Passed (preview). Workspace isolation of a future assistant is a contract only. |
| M04-AC03 | Daily actions and weekly reviews reflect actual authorized evidence                            | DB: idempotent generation, 3 to 5 bound, persistence, completion timestamp set once, plan-linked completion updates M03, observations append-only and survive goal edits, weekly periods, local-time boundaries, no double counting, "insufficient evidence" stored, no percentages. Unit: rules and narrative. | Passed on PostgreSQL. Live Supabase pending.                                    |
| M04-AC04 | Global search cannot retrieve other tenants' records                                           | DB: another Creator's idea, action and plan text return `[]` with no count or snippet; wildcards are literal; direct table access denied; cross-workspace search denied for Creator, Brand, Agency and non-owner.                                                                                               | Passed on PostgreSQL. Live Supabase pending.                                    |
| M04-AC05 | Widget visibility persists, the walkthrough is skippable and campaign eligibility is explained | DB: preferences persist, validate, reset and are per workspace and user; walkthrough states stored and replayable. Browser: skippable at any step and with Escape, repeatable, offer is non-blocking; seven eligibility facets explained, standard threshold and "not added together" stated, UGC separate.     | Passed (DB, preview). Settings page not exercised in a live session.            |

## Execution record

- Unit and database: **109 passed, 0 skipped** (9 files): 17 existing M01/M02, 48 M03, 44 M04 (36 domain, 8 database including three concurrency tests).
- SQL scenario groups: M04 **18 groups passed**.
- Browser: all passed, 0 skipped (existing 49 M01/M02, 30 M03, 56 M04): **135 passed** on the final full run.
- Format, ESLint, strict TypeScript, production build: passed. `pnpm audit`: no known vulnerabilities. Secret scan: pattern search only (gitleaks not installed), clean.
- Runtime: **Node 22.23.5**, not the pinned Node 24.

## Not executed

Live Supabase connectivity, Auth sessions through the real client, RPC invocation through PostgREST, email or SMS, and any provider AI. **Update:** the real layout, pages and server actions have now been driven in a browser (11 tests) against a local stand-in for Supabase Auth and the RPC endpoint (`pnpm test:stack`). That is **not** Supabase.

## Manual acceptance checklist

1. Apply the M02, M03 and M04 migrations to a disposable Supabase project (the M02 syntax error is fixed on this branch). Or use the local test stack in `docs/development/TESTING_GUIDE.md`.
2. Sign in as a Creator with onboarding **incomplete**. Confirm `/creator/dashboard` sends you to `/onboarding/creator`.
3. Complete onboarding with no social account. Open Creator Studio. Confirm no audience figures appear and 3 to 5 actions are shown.
4. Reload several times. Confirm the same actions remain. Mark one done, one skipped, one later. Confirm timestamps and the plan action in M03.
5. Record two progress numbers on a goal with a measure. Confirm the chart and data table appear only after the second. Edit the goal in M03 and confirm history remains.
6. Toggle widgets, milestones and the time zone in settings. Confirm persistence after sign-out and sign-in. Reset.
7. Take the walkthrough, skip it, and replay it.
8. With two users, search for a distinctive word from one user's idea as the other. Confirm nothing is returned. Try a Brand user.
9. Revoke membership and confirm access is lost. Open two tabs and complete the same action in both.
10. Review at 320 to 1920 px and with a screen reader and keyboard only.
