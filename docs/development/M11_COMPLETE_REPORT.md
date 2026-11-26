# M11 complete report: Applications and invitations

Branch `feature/m11-applications`, built on M10. Not merged.

## Delivered

Migration `20261203000100_m11_applications.sql` (schema `aura_apply`, 16 tables, 33 public functions for Creators, Brands and reviewers, four new reserved usernames). Creators: an application form with autosaved drafts, screening answers, chosen account, portfolio items and media kit, an optional quote and a live preview of exactly what the Brand will see; application pages with status, progress, questions to answer, edits before review (new versions), withdrawal and one reapplication; invitations (interested, ask, decline, block, report); enquiries; blocked Brands; a negotiation workspace with versioned proposals, field-by-field changes, confirmation of an exact version, schedule-conflict warnings and short reportable messages. Brands: application rules and screening (unpaid custom work refused), an applicant list, an application page with review, questions, shortlist, waitlist, selection within capacity and rejection with feedback, invitations by published username, enquiries, an inbox and the same negotiation workspace. Reviewers: `/admin/applications` for reports. The M10 "Check and apply" button now opens the application form, and M10's Brand invite form moved to M11.

Nothing in M11 is binding: the end state is "ready for an agreement", which M12 turns into an agreement.

## Verification

Final run on local PostgreSQL 16 with auth and storage stubs (not live Supabase): Prettier, ESLint and typecheck clean; Vitest 20 files, 268 passed, 0 skipped; Playwright browser suite 135 passed; stack suite 33 passed; production build compiled; `pnpm audit --prod` no known vulnerabilities. M11 adds 11 SQL scenario groups, 10 database tests (including the M03 to M10 suites re-run on the M11 schema, a full reserved-username drift check, and 3 concurrency races: duplicate submissions, the last selection position, simultaneous confirmations), 6 domain tests and 3 stack tests (a full two-sided journey from screening to "ready for agreement", invitations with blocking and moderated reports, edits, withdrawal and reapplication limits; accessibility and overflow on 10 pages at three widths; screenshots in `evidence/m11`).

Also changed: the M04 drawer focus test now checks every Tab press instead of the element reached after exactly 40 presses (the new nav entry shifted that count); the M11 stack spec is named to run after the M10 spec because the stack database is shared.

## Not built (honestly reported)

AI drafting and readiness (M07), Agency delegation (denied until approved), reminders and email (M25), scheduled expiry (evaluated on read), risk scoring, a reporter-facing report status page, retention periods.

## Decisions needing owner approval

See the M11 entry in `DECISION_REGISTER.md`: lock at the Brand's first action, 14-day invitations, 7-day proposals, 5-day clarifications, reapplication rule, daily limits, free-text messages beside proposals, username-only Creator lookup for Brands.
