# M09 complete report: Creator profile and media kit

Branch `feature/m09-creator-profile`, built on M06 (`main`). Pushed to GitHub; **not merged**. M07 and M08 are not merged; their touch points are contracts.

## Delivered

- Migration `20261201000100_m09_creator_profile.sql`: private schema `aura_profile` (20 tables), 27 public functions, two anonymous projections (`aura_public_profile`, `aura_public_kit`) and the allowlisted M01 directory view `m01_public_creator_previews`. Widens M03's profile visibility to private or public; adds the `profile` dashboard widget.
- Creator Studio: profile hub with publish and discovery controls, details, appearance (4 themes, CSS/SVG covers, accessible section ordering), preview, checklist (not a score), rule-based suggestions, privacy, availability, verification indicators, analytics, experience, testimonials; portfolio and case studies; services; rates; packages; media kits with sections, item choice, live preview, snapshots and share links.
- Public site (`(site)` route group): `/creator/[username]`, `/kit/[token]` with PDF download, `/feedback/[token]`; reviewer page `/admin/profile-reviews`.
- Dependency-free QR encoder (level M, versions 1 to 10) and text PDF for kits.
- A fix to the public pages: they show "not found" instead of an error when no data provider is configured.

## Verification (this environment, local PostgreSQL 16 with auth and storage stubs; NOT live Supabase)

| Gate                         | Result                                                                                                                                                                                                                                                                                               |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prettier, ESLint, typecheck  | clean                                                                                                                                                                                                                                                                                                |
| Vitest with `AURA_TEST_DB=1` | 16 files, 234 passed, 0 skipped                                                                                                                                                                                                                                                                      |
| of which M09                 | 8 SQL scenario groups; 11 database tests (RLS and grants, anon surface, search_path, reserved-username drift against every Studio route, hashed tokens, M03/M04/M05/M06 suites re-run on the M09 schema, 3 concurrency races); 9 domain tests; 3 QR tests (88 reference matrices, module for module) |
| Playwright browser suite     | 135 passed                                                                                                                                                                                                                                                                                           |
| Stack suite (real routes)    | 26 passed (6 of them M09, including axe and overflow on 19 pages at 320, 768 and 1280, and all four public themes)                                                                                                                                                                                   |
| Production build             | compiled                                                                                                                                                                                                                                                                                             |
| `pnpm audit --prod`          | no known vulnerabilities                                                                                                                                                                                                                                                                             |

## Not done or partial

Enquiries (always refused until M14 Brand verification), uploads and cover images (no private bucket or scanner), M08 Content Studio records, AI kit writing and suggestions (M07), collaboration indicators (M12), entitlements and branding removal gating (M27), custom domains. A Brand without MFA is sent to MFA before writing a testimonial (M02 policy).

## Proposed defaults needing owner approval

See the M09 section of `DECISION_REGISTER.md`.
