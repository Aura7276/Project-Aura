# Project AURA agent handover

Start with [AGENTS.md](../../AGENTS.md) and the [requirements baseline](../../AURA_Requirements_v0.14/README.md). AURA is an India-first platform for Creator growth, Brand-owned marketing and commercial collaboration. The application is a strict TypeScript modular monolith using Next.js App Router. Shared public routes and design components are separate from server-only identity and Supabase data access. Database migrations, workspace authorization and private storage policies are staged with the features that use them. [Architecture](../architecture/SYSTEM_ARCHITECTURE.md)

## Checkout state

Phase 00 and M01.01–03 have conditional acceptance. M01.04 Brand landing is implemented and awaits owner acceptance. Inspect /, /creators and /brands. The development-only catalog lives at /dev/design-system. Studio examples and FAQs work locally. Registration and other pending destinations retain their readiness treatment. M01-F03 and F05 have partial public coverage. M02–M14 business implementations remain Not started. See [traceability](REQUIREMENTS_TRACEABILITY.md), [sequential roadmap](DEVELOPMENT_ROADMAP.md), [status](DEVELOPMENT_STATUS.md) and [decisions](DECISION_REGISTER.md).

The authorized task is the initial local GitHub baseline. Initial push requires verified private visibility and explicit owner approval. The next product decision is manual M01.04 acceptance. M01.05 Agency landing requires separate authorization. Keep all other approved source and evidence intact. Scope M14–M22 supplementary decisions to marketing copy only. Paid influencer, UGC and barter are planned first; events and ambassador follow, affiliate depends on attribution readiness. Continue the visual placeholder policy through M14.

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
