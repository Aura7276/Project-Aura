# Dependency register

Exact resolved versions are recorded below and in pnpm-lock.yaml. Node 24.22.3, pnpm 11.25.0 and Git 2.56.0.windows.4 were used. Next and eslint-config-next use matching versions; React and React DOM match. Registry engines/peers, strict peer installation, typechecking, production build and browser behavior are compatibility checks. ESLint 9.39.5 is deprecated upstream. The React lint plugin bundled by eslint-config-next declares support through ESLint 9; revisit the toolchain together.

Radix supplies interactions for the source-distributed shadcn/ui new-york-v4 primitives. The registry snapshot has no installed shadcn CLI version. class-variance-authority, clsx and tailwind-merge support local variants and class composition. Fontsource self-hosts the selected typefaces. server-only guards privileged imports. axe-core/playwright runs automated accessibility checks. React Hook Form owns form state and Zod validates values and configuration.

Supabase PostgreSQL 17 is the proposed local configuration. Server, Auth and Storage service versions are unverified. Docker and Supabase CLI were unavailable. OAuth, SMTP, private buckets and tenant policy tests depend on later modules. M17/M18 govern commercial Brand workflows, M23 delegation, M24/M25 communications, M26 roles, M27 monetization, M28 admin, M29 verification and M30 privacy.

References: [Next installation](https://nextjs.org/docs/app/getting-started/installation), [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [shadcn manual installation](https://ui.shadcn.com/docs/installation/manual).

## Installed packages

- @fontsource-variable/inter 5.3.0
- @fontsource-variable/plus-jakarta-sans 5.3.0
- @supabase/ssr 0.12.7
- @supabase/supabase-js 2.119.2
- @tailwindcss/postcss 4.3.5
- class-variance-authority 0.7.1
- clsx 2.1.1
- lucide-react 1.79.0
- next 16.4.6
- radix-ui 1.8.1
- react 19.3.1
- react-dom 19.3.1
- react-hook-form 7.92.0
- server-only 0.0.1
- tailwind-merge 3.7.1
- tailwindcss 4.3.5
- zod 4.6.7
- @axe-core/playwright 4.14.0
- @playwright/test 1.65.1
- @types/node 24.19.2
- @types/react 19.3.0
- @types/react-dom 19.3.0
- eslint 9.39.5
- eslint-config-next 16.4.6
- prettier 3.10.1
- typescript 5.9.3
- vitest 4.1.12

M01.02 reuses Next Image, shadcn Tabs/Button and Lucide. Lighthouse ran as a transient development tool. No new application dependency.

M01.03 reuses existing packages. Registration depends on M02/M03; opportunities on M10–M12 and Brand campaign workflows; affiliate on attribution readiness. No external visual or AI service dependency.

M01 public delivery adds no package dependencies. Optional server configuration: AURA_PUBLIC_PROJECTIONS_ENABLED and AURA_SUPPORT_EMAIL. See M01_MODULE_REPORT.md for the M02/M09/M10/M27/M30 release gates.

M02 reuses the installed Supabase SSR and JavaScript clients. Live acceptance depends on a disposable Supabase project, Google OAuth configuration, SMTP and an SMS provider for phone verification. See [M02 configuration](M02_AUTHENTICATION.md).

M03 adds no package dependencies. It depends on the M02 identity schema and functions. Live acceptance needs a disposable Supabase project with both migrations (after the M02 syntax fix). Screenshots need a private Storage bucket with owner-scoped policies and malware scanning. AI-assisted onboarding needs M07. Account refresh needs M05, opportunities and campaign requirements need M10 and M11, reminders need M25, and publication needs M09. Per-user rate limiting is per instance only, so multi-instance deployments need an edge or WAF limiter. Browser tests honour an optional `PW_CHROMIUM_PATH` for environments without the pinned Chromium.

M04 adds no package dependencies (no chart or animation library; the trend chart is inline SVG). It depends on the M02 identity functions and the M03 schema. Live acceptance needs a disposable Supabase project with the M02 (after its syntax fix), M03 and M04 migrations. The assistant needs M07, notifications and the digest need M25, the commercial overview needs M13, campaigns and requirements need M10 and M11, collaborations need M12, content and calendar need M08, portfolio needs M09, and verified or provider-derived observations need M05 and M06. Rate limiting is per instance only. Browser tests honour an optional `PW_CHROMIUM_PATH`.

Test infrastructure: `scripts/stack` is a local stand-in for Supabase Auth and the RPC endpoint (not Supabase) used by `pnpm stack` and `pnpm test:stack`. It needs PostgreSQL 15 or newer with `psql` on PATH and adds no package dependency. It mints sessions only for itself and must never be deployed.

## M05 dependencies

Unmet: platform provider APIs and OAuth (M06 and later), malware scanning for evidence, AI extraction (M07), email delivery (M25), private Storage bucket on a live Supabase project, M11/M12 for the paid-influencer gate.

## M06 dependencies

Unmet: AI classification and pattern interpretation (M07), content metadata ownership (M08), media kit use of shared audience (M09), campaign matching (M10, M16), collaboration and deliverable links (M12), earnings (M13), entitlements (M27), provider data and legal review for competitor tracking, a live Supabase project, scheduled insight generation (insights refresh when the page opens).

## M09 dependencies

No new package (QR and PDF are written in-house). Unmet: M08 Content Studio records, M07 AI assistance, M14 Brand verification for enquiries, M12 collaboration indicators, M27 entitlements, private storage bucket and malware scanning for uploads, a live Supabase project.

## M10 dependencies

No new package. Unmet: M14 Brand onboarding and verification (interim reviewer used), M11 applications, M12 agreements, M07 AI assessment, M25 email alerts, M27 promoted placements, a scheduler for deadline alerts, payment availability rules for international campaigns.

## M11 dependencies

No new package. Unmet: M12 agreements, M07 AI drafting, M25 reminders and email, a scheduler for expiries (evaluated on read), Agency delegation, M14 Brand verification (interim reviewer), retention policy (M17/M18).

## M14 dependencies

No new package. Unmet: M07 AI (website extraction, tone and persona suggestions, onboarding conversation), SSRF-safe website retrieval, a scanned private storage bucket (logos, guideline files, verification documents), M05 analytics for Brand accounts, M17 campaign enforcement of budgets and conflicts, M23 Agency delegation, M25 reminders, M26 roles, M15 Brand navigation.

## M12 collaboration workspace

No packages added. Uses M02 verified identity and MFA, M08 private content versions, existing dialogs and Lucide. Requires confirmed M11 proposals for production provisioning, approved legal templates, hosted migration deployment, M13 settlement, M25 notification delivery, M09 portfolio consent and explicit Agency delegation. File limits, scanning and retention remain unresolved. Tests and hosted execution were not performed under the owner’s build-only instruction.

## M13 commercial workspace

No packages added. Depends on M02 identity, M03/M04 Creator ownership, M12 participant checks, and migration 20261206000100. Structured accepted commercial terms from M11/M12, M25 reminders, tax/invoice validation, currency precision, FX sources, private uploads/scanning and retention remain pending. Hosted migration and all testing are deferred.

## M15 Brand dashboard

No packages added. Uses existing M02 identity, MFA and membership, M12 collaboration permissions, Radix dialogs, Lucide and the design system. M14 onboarding source is absent in this checkout. M16–M22 business integrations, M25 notifications and M26 granular roles remain pending. Migration deployment and all validation are pending.
