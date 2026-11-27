# M14 complete report: Brand onboarding

Branch `feature/m14-brand-onboarding`, built on `main` (M11) with Jai's M07 and M08 branch merged in. Not merged into `main`.

## Delivered

- **Merge of M07 and M08** (`feature/m08-content-studio`): three conflicts resolved; the M08 migration renamed to `20261130000200` (it shared a version with M09); `ai` and `content` reserved as usernames; the test stack now applies the M07 and M08 migrations; four older tests updated to the M08 interface (Growth Studio link, Content Studio, collapsed dashboard widgets); one lint fix.
- **Migration** `20261207000100_m14_brand_onboarding.sql`: schema `aura_brand`, 15 tables, 26 public functions. It also points the M09 enquiry stub at the real verification state.
- **Brand area**: a private home with a setup checklist, this week's plan and a verification call to action; a six-step onboarding (two required steps); business profile with public and private identity kept apart; products with approved claims; customer groups labelled hypothesis or confirmed; goals, a five-question maturity check without a score, and an optional indicative budget; 7, 30 and 90-day plans that keep your edits; brand guidelines; Creator preferences with plain explanations of suitable Creator segments; competitors; up to 10 Brand social accounts; and a Brand brief that brings it all together.
- **Business verification**: evidence by business type, a declaration, information requests, rejection with reasons, resubmission, one appeal decided by a different reviewer, and revalidation of legal identity changes that pauses outreach. The reviewer queue is at `/admin/verification`; the old interim list on `/admin/marketplace` now links there.
- **Public Brand profile** at `/brand/[slug]`: private by default, only for verified Brands, public fields only. Creators also see it on the marketplace Brand page.

## Verification

Final run on local PostgreSQL 16 with auth and storage stubs (not live Supabase): Prettier, ESLint and typecheck clean; Vitest 22 files, 286 passed, 0 skipped; Playwright browser suite 137 passed; stack suite 35 passed; production build compiled; `pnpm audit --prod` no known vulnerabilities. M14 adds 10 SQL scenario groups, 9 database tests (all earlier SQL suites re-run on the M14 schema with M07 and M08 applied, route and matrix drift checks, and 3 concurrency races: the 10-account limit, one open case, two reviewers deciding one case), 9 domain tests and 2 stack tests (the full Brand journey with an information request, publication and privacy checks; accessibility and overflow on 14 pages at three widths; screenshots in `evidence/m14`).

## Not built (honestly reported)

AI features (website extraction, tone and persona suggestions, onboarding conversation) need M07 AI and SSRF-safe fetching; logo, guideline and document uploads need a scanned private bucket; Brand social analytics; learning resources and individual Creator recommendations; campaign enforcement of budgets and conflicts (M17); the role matrix (M26); reminders (M25).

## Decisions needing owner approval

See the M14 entry in `DECISION_REGISTER.md`: required fields, eight business types and the evidence matrix, typed evidence until uploads exist, the appeal window, pausing outreach during revalidation, publication rules, the daily case limit, and the minimal Brand header pending M15.
