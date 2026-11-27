# M17 complete report: Campaign creation and management

Branch `feature/m17-campaigns`, built on `main` (M01–M15). Built from the reconstructed module file (10 recovered requirements; the original 60 are not recovered), so M17-F numbers are not assigned.

## Delivered

- **Migration** `20261209000100_m17_campaign_management.sql`: schema `aura_campaign` (rollout setting, private campaign plans, amendment log), 7 public functions, and two triggers on the M10 tables.
- **Rollout (R2)**: paid influencer, UGC and barter publish now; events, ambassador and affiliate can be drafted but not published or sent to review until opened. Enforced by a database trigger, labelled everywhere.
- **Campaign management** at `/brand/campaigns`: totals (live, applications, open places, drafts), filters by status and archive, a row per campaign with applications, selections, open places, saves, owner and next milestone; duplicate (idempotent) and archive.
- **Six-step builder** at `/brand/campaigns/[id]/build`: objective and audience (a private plan with KPI, M14 audiences and products, owner, milestones and notes), brief (optionally prefilled from what the Brand confirmed in M14), deliverables, compensation and rights, eligibility, and preview and publish with a readiness list linking each missing item to its step.
- **Preview** and **Changes** pages; campaign tabs on every campaign page, including the M10 editor and the M11 applications page.
- **Positions (R8)**: Creators see how many places are still open; published positions can never drop below the Creators already selected, under the same lock as M11 selection.
- **Change notices (R8, R10)**: material changes now also reach applicants and Creators in negotiation (M10 already told Creators who saved it); each is logged with who was told; agreed proposals keep their terms.

## Changes to earlier modules

- M10 draft validation accepts an empty summary, brief, deliverables and closing date, so the builder can save one step at a time; publication still requires them (database check).
- The M10 stack test publishes a barter campaign instead of an event (events are draft-only now).
- The M04 stack test expected a "Not available yet" commercial badge that M13 replaced with a real empty state; updated.

## Verification

Local PostgreSQL 16 with auth and storage stubs (not live Supabase): Prettier and typecheck clean, ESLint 0 errors (1 existing warning); Vitest 24 files, 301 passed; browser suite 137 passed; stack suite: 28 passed in the full run, and the two specs that failed there (one test race in the new M17 test, one stale M04 assertion) pass 12 of 12 after the fixes; production build compiled; `pnpm audit --prod` no known vulnerabilities. M17 adds 6 SQL scenario groups, 7 database tests (M10, M11 and M14 suites re-run with the M17 guards, field coverage and trigger checks, and 2 concurrency races: a positions cut against a selection, and duplicate requests), 8 domain tests and a stack test (the full journey; accessibility and overflow on 6 pages at three widths; screenshots in `evidence/m17`).

## Not built

The original 60 requirements; the M12 link to M11 proposals and campaign versions (R10 partial); M18 selection reservations; M22 campaign budgets; Agency delegated creation (M23); AI brief drafting.
