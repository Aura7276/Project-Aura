# M03 acceptance

Owner acceptance is **not** recorded. This is evidence for the owner's manual review.

Evidence legend: **DB** = real PostgreSQL 16 with the actual M02 (patched copy, see defect) and M03 migrations and an `auth` stub. **Unit** = Vitest. **Browser** = Playwright against the development preview (same components and validators, no persistence) or real anonymous routes. **Live Supabase** = not executed.

| ID       | Criterion                                                | Evidence                                                                                                                                                                                                                                                                                                                                                                                   | Result                                         |
| -------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| M03-AC01 | Aspiring Creator completes onboarding without an account | DB: "aspiring creator activates with no social account; profile private; plan persisted; audit recorded". Unit: no-account path valid, `canActivate` with zero accounts. Browser: "I don’t have a social account yet" proceeds.                                                                                                                                                            | Passed on PostgreSQL. Live Supabase pending.   |
| M03-AC02 | 100-follower rule independent of activation              | Unit: 0, 99, 100, 60+60 (not summed), Brand page excluded, unknown stays unknown, activation and eligibility independent, segments. DB: Creator with accounts below 100 activates.                                                                                                                                                                                                         | Passed (unit, DB).                             |
| M03-AC03 | Optional questions skipped and resumed                   | DB: skip recorded as `skipped`, unanswered distinct, mandatory skip rejected, state resumes from a new connection. Unit: `nextStep`. Browser: skip navigates on.                                                                                                                                                                                                                           | Passed on PostgreSQL. Login resume not live.   |
| M03-AC04 | Goals and exclusions persist and inform recommendations  | DB: goals saved and edited, exclusions saved, edited, take precedence, cannot coexist with a preference. Unit: guidance reflects goals and constraints, excluded industries never recommended.                                                                                                                                                                                             | Passed (DB, unit).                             |
| M03-AC05 | No private data publicly exposed                         | DB: anon denied, authenticated direct table denied, cross-creator, wrong workspace, Brand, Agency and non-owner denied, no grants to `anon`/`authenticated`/PUBLIC, RLS on every table, `visibility` cannot be public. Browser (production build): anonymous onboarding routes redirect, `no-store`, nonce CSP, preview 404. Unit: recommendations never emit private goals or challenges. | Passed. Live Supabase and storage RLS pending. |

## Execution record

- Unit: 65 passed in 7 files (17 existing M01/M02, 48 M03), 0 skipped (database tests enabled).
- Database scenarios: 17 groups passed, plus 8 Vitest database tests including a real two-session concurrency conflict.
- Browser: 79 passed (49 existing M01/M02, 30 M03), 0 skipped.
- Format, ESLint, strict TypeScript, production build: passed. `pnpm audit`: no known vulnerabilities. Secret scan: pattern grep only, clean (gitleaks not installed).
- Runtime: **Node 22.23.5**, not the pinned Node 24. Not re-run on Node 24.

## Not executed

Live Supabase connectivity (`pnpm supabase:check`), Auth sessions through the real client, PostgREST RPC invocation, Storage policies, authenticated end-to-end browser flow through the real server actions and pages, and email or SMS. No project credentials were available.

## Manual acceptance checklist

1. Apply M02 and M03 to a disposable Supabase project. **M02 must first fix its migration** (see defect in the report).
2. Register, verify email, create a Creator workspace, and open `/onboarding/creator`.
3. Complete only the three required steps with no social account. Activate. Confirm the plan, checklist, eligibility text and private status.
4. Sign out and in mid-way. Confirm resume at the right step.
5. Add accounts of 60 and 60 followers. Confirm "not yet" for standard influencer. Add 100 on one. Confirm "meets guide, unverified".
6. Add an exclusion. Confirm it cannot also be preferred and nothing excluded is recommended.
7. With two users, confirm neither can read the other's data, and a Brand user cannot.
8. Open two tabs, save from both, and confirm the conflict message.
9. Review at 320 to 1920 px and with a screen reader.
