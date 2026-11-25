# Development procedures — proposed execution playbook

## 0. Preserve current work
On Windows open existing repository `D:\Project Aura\Project_AURA_Production_Codex_Package` in Codex. Verify actual path and Git status. Back up uncommitted work; do not overwrite source, migrations, `.env.local` or existing root AGENTS.md blindly. Extract this package into `docs/requirements/v0.14/`. Review diffs and update root AGENTS.md to point to this baseline only after human approval. Earlier packages are historical; no legacy prompts are authorized by this release.

Suggested PowerShell checks (run from your repository; adapt path):
```powershell
Set-Location 'D:\Project Aura\Project_AURA_Production_Codex_Package'
git status --short
git branch --show-current
node --version
pnpm --version
git log -5 --oneline
```
Create a development branch only after preserving current changes. Audit actual routes, auth, database migrations, policies, tests, package scripts and environment variables against v0.14; record findings in IMPLEMENTATION_STATUS.md. Do not scaffold a second application if one exists.

## 1. Foundation
Proposed stack Next.js App Router, TypeScript, Tailwind/shadcn, Supabase Auth/Postgres/Storage, Zod, Vitest, Playwright. Validate existing versions and current SDK practices. Set up dev/staging/prod isolation; use real local or staging Supabase. Configure OAuth/SMTP and redirect URLs. Create `.env.example` with placeholders; never commit `.env.local` or real secrets. Supabase URL and publishable/anon key are client-safe only with correct RLS; service role key strictly server-only and minimized. AI/SMTP secrets server-only. No provider selected or credentials supplied by this package.

## 2. Module delivery SOP
For every approved module: identify F IDs and dependencies → document selected MVP subset and exceptions → review screen/state/data/permission specification → prepare migration and RLS/storage tests → implement backend validation and transactional rules → build responsive frontend with all states → unit/integration/E2E and adversarial tests → human UAT → evidence update → merge after review. Work in vertical slices, not a mass generation run. Stop for unresolved business rules; no invented policy or simulated integration. M15–M30 not authorized as finalized scope.

## 3. Database change SOP
Inspect existing schema; create additive versioned migrations, never silently rewrite applied history. Back up before staging migration. Test clean install and upgrade, constraints, cross-tenant RLS and rollback/forward-fix. Use transactions/idempotency for financial and commercial transitions. Production migrations require explicit approval, maintenance/rollback plan and backup evidence. Do not run destructive tests against production.

## 4. Testing and quality SOP
Suggested commands once actual scripts verified:
```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm exec playwright test
pnpm build
pnpm dev
```
If scripts or lockfile are absent, document the gap and establish them before relying on commands. Do not claim pass based on missing/skipped tests. Test with separate nonproduction Creator A/B, Brand A/B, unverified Brand, delegated user and admin fixtures; fixtures never leak into production. Store screenshots, test output, execution counts and migration results. Validate real login, sign-up, email verification, route access and persistent DB records visibly in browser. Test direct API and RLS bypass attempts. See 13_ACCEPTANCE_CRITERIA.md.

## 5. Release procedure
Review scope and dependencies; deploy staging with real auth/DB/storage, run smoke and full regression; security/privacy and required commercial/legal review; backup/restore drill; founder UAT; production release approval; deploy migration/app in safe order; verify health/auth/critical journeys; monitor errors and jobs; rollback/forward-fix on failure. No production rollout or credentials created by this handover.

## 6. Definition of done
Requirement traceability, real persistence, server authorization, positive and negative tests, no fake production metrics, documented limitations, accessible responsive states, observability and evidence. Update status per module and do not mark approved requirements as implemented merely because UI renders.
