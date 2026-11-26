# Project AURA agent handover

Current work: M04 Creator dashboard is Implemented on `feature/m04-creator-dashboard` (based on M03 commit `dbf750b`), pending live Supabase verification. See [M04 report](M04_COMPLETE_REPORT.md) and [Creator Studio architecture](../architecture/CREATOR_STUDIO_ARCHITECTURE.md). M02's migration syntax defect is fixed on this branch (`b1f6d9e`). Use `pnpm stack` and `pnpm test:stack` for local end-to-end testing without Supabase (a stand-in, not Supabase), and see [the testing guide](TESTING_GUIDE.md). M03 Creator onboarding is Implemented on `feature/m03-creator-onboarding` (based on M02 commit `471c4d6`), pending live Supabase verification. See [M03 report](M03_COMPLETE_REPORT.md) and [architecture](../architecture/CREATOR_ONBOARDING_ARCHITECTURE.md). M02's migration has a syntax defect that must be fixed first. M02 registration and authentication is In progress. See [M02 integration and acceptance](M02_AUTHENTICATION.md).

Start with [AGENTS.md](../../AGENTS.md) and the [requirements baseline](../../AURA_Requirements_v0.14/README.md). AURA is an India-first platform for Creator growth, Brand-owned marketing and commercial collaboration. The application is a strict TypeScript modular monolith using Next.js App Router. Shared public routes and design components are separate from server-only identity and Supabase data access. Database migrations, workspace authorization and private storage policies are staged with the features that use them. [Architecture](../architecture/SYSTEM_ARCHITECTURE.md)

## Checkout state

M01 public delivery includes the audience pages, demo, resources, pricing, support, contact and guarded discovery/invitation routes. Check M01_MODULE_REPORT.md for current integration gates. M02–M14 business implementations remain Not started. See [traceability](REQUIREMENTS_TRACEABILITY.md), [sequential roadmap](DEVELOPMENT_ROADMAP.md), [status](DEVELOPMENT_STATUS.md) and [decisions](DECISION_REGISTER.md).

The owner authorized module-by-module delivery through M01. Review the public site and integration gates before acceptance. M02 requires separate approval. The local baseline remains unsynchronized. Keep all other approved source and evidence intact. Scope M14–M22 supplementary decisions to marketing copy only. Paid influencer, UGC and barter are planned first; events and ambassador follow, affiliate depends on attribution readiness. Continue the visual placeholder policy through M14.

## Toolchain

Node 24.22.3, pnpm 11.25.0, Git 2.56.0.windows.4, Next.js 16.4.6, React/React DOM 19.3.1, TypeScript 5.9.3, Tailwind 4.3.5, source-distributed shadcn/ui new-york-v4, Radix UI 1.8.1, Lucide React 1.79.0, Supabase JS 2.119.2 and SSR 0.12.7, Zod 4.6.7, React Hook Form 7.92.0, Vitest 4.1.12, Playwright 1.65.1, axe Playwright 4.14.0, ESLint 9.39.5 and Prettier 3.10.1. The [dependency register](DEPENDENCY_REGISTER.md) lists supporting packages. Use the committed lockfile. Local PostgreSQL configuration targets version 17. Hosted PostgreSQL, Auth and Storage service versions await verification.

## Local checks

From the repository root run:

```powershell
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm dev --port 3101
```

In another terminal run:

```powershell
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
pnpm audit
```

Playwright exercises development on 3101 and starts production on 3102. The static public experience works without credentials. Hosted Supabase configuration remains deferred. When authorized, privately configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local using the safe .env.example. Run pnpm env:check and pnpm supabase:check only with the intended environment. Never share secrets or use production customer data for tests.

## Delivery

Claim one task and one branch. Inspect the relevant requirements, their original F IDs and existing code before editing. Coordinate shared-file ownership and isolate simultaneous changes with separate worktrees. Document changes, real test counts, blockers and manual acceptance criteria in the stage report and traceability. Run applicable regression tests and security checks. Submit a reviewed diff and evidence to the owner. Owner acceptance and approval to start a later stage are separate decisions.

## M05 handover

Branch `feature/m05-social-account-management`. Code: `src/features/creator-social`, `src/server/social`, migration `20261128000100`. Run DB tests with a local PostgreSQL 16 (`AURA_TEST_DB=1 pnpm exec vitest run`); stack tests need `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium` here. Follow-ups: daily-action rule and search entries for stale accounts, Brand-facing views, providers.

## M06 handover

Branch `feature/m06-creator-analytics`. Code: `src/features/creator-analytics`, `src/server/analytics`, `src/lib/use-idempotent-form.ts`, migration `20261129000100`. DB tests need a local PostgreSQL 16 (`service postgresql start`, a superuser role named for the shell user) and `AURA_TEST_DB=1`. Stack tests: `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm test:stack --trace off`. Not integrated with M04 daily actions, weekly review or own-experiment search (needs M04 schema coordination). Forms now submit through `useIdempotentForm` so a failed validation no longer clears what was typed.

## M09 handover

Branch `feature/m09-creator-profile` from M06. Migration `20261201000100` is dated so an M08 migration can sort before it. Merge points with M08: `aura_studio.dashboard_pref` widget allowlist (M09 adds `profile`), Studio nav, `aura_social.content_ref`, and `portfolio_item.studio_ref` (reserved for M08 records). The public profile moved from `(public)` to a new `(site)` route group. QR reference fixtures were generated once with the Python `qrcode` 8.2 package (`tests/unit/fixtures/qr-reference.json`).

## M10 handover

Branch `feature/m10-campaign-marketplace` from M09; migration `20261202000100`. The test stack accepts `{ mfa, admin }` when seeding a user (test-only) so Brand owners and reviewers can sign in with MFA. M11 should call `aura_market_check_apply` before accepting an application and replace the "applications open with M11" state. M14 should take over `aura_identity.workspace.verification` decisions and keep `aura_market.verification_decision` history.

## M11 handover

Branch `feature/m11-applications` from M10; migration `20261203000100`. M12 should start from `aura_apply.collaboration` rows with status `ready_for_agreement` and their `ready_proposal`, re-check eligibility (including the M05 paid-influencer gate) at acceptance, and set applications to `converted`. M25 should add reminders and email from `aura_apply.notification`. The M10 "invite" form moved to M11 (message, expiry, blocking). New reserved usernames: applications, invitations, enquiries, negotiations.
