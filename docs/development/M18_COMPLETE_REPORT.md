# M18 complete report: Creator selection and comparison

Branch `feature/m18-selection`, built on `main` (M01–M17). Built from the reconstructed module file (8 recovered requirements; the original 45 are not recovered), so M18-F numbers are not assigned.

## Delivered

- **Migration** `20261210000100_m18_selection.sql`: schema `aura_selection` (holds, private notes, hand-off records, settings), 10 public functions, and two triggers on the M11 tables.
- **72-hour holds**: a Brand offers a place; it is held for 72 hours and counts against positions at once. The Creator accepts (eligibility re-checked; the application becomes selected) or declines (application withdrawn). Unanswered holds expire and free the place; both sides are told. Holds are counted on every selection path, including M11's own, under the same lock.
- **Applicant inbox** on the campaign's Applications tab: a capacity meter (places taken or held), views (new, in review, shortlist, held, selected, closed), requirements met, account with source and date, quote, work shared, open questions, tags; bulk review, shortlist and reject with feedback (selection is never a bulk action).
- **Comparison** of 2 to 4 candidates side by side from each Creator's shared data only: requirements and preferences met or not, account, pitch, screening answers, work, compensation, dates and tags. No score and no ranking.
- **Candidate panel**: offer or release a place, private team notes and tags (never shown to the Creator).
- **Creator offer panel**: the offer, the Brand's message and the deadline, with accept or decline.
- **One project hand-off**: when both sides confirm the same proposal version in M11, an M12 collaboration workspace opens automatically with the agreed terms (one deliverable per item, compensation, rights, exclusivity), status "Agreement pending". Both negotiation pages link to it. The M12 agreement still needs both acceptances and an approved legal template.

## Changes to earlier modules

- The Brand decision menu no longer offers "Select" directly; places are offered and accepted. The M11 stack test follows the new flow.
- The M11 applicant table is replaced by the M18 inbox.

## Verification

Local PostgreSQL 16 with auth and storage stubs (not live Supabase): Prettier and typecheck clean, ESLint 0 errors (2 existing warnings); Vitest 26 files, 312 passed; browser suite 137 passed; stack suite 37 passed; production build compiled; `pnpm audit --prod` no known vulnerabilities. M18 adds 6 SQL scenario groups, 6 database tests (the M17, M14 and M11 suites re-run with the M18 triggers, trigger and grant checks, and 2 concurrency races: two holds for the last place, and an acceptance against a direct selection), 5 interface-rule tests and a stack test (the full journey through to the M12 workspace; accessibility and overflow; screenshots in `evidence/m18`).

## Not built

The original 45 requirements; M22 budget reservations on holds; a scheduler for expiry and reminders; M16 Creator discovery; approved M12 agreement templates.
