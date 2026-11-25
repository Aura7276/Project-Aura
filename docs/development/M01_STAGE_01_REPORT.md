# M01.01 · Global public navigation

Phase 00 received conditional acceptance. M01 is In progress. M01.01 awaits manual acceptance. Inspect http://127.0.0.1:3101/.

## Delivered

The public route group provides the shared sticky header, temporary typography-led wordmark, page container, main landmark, skip link, metadata and eight-group footer. Desktop dropdowns and the compact modal reuse the existing Radix-backed primitives. The compact menu applies below 1200px to accommodate the full desktop hierarchy. Its native disclosures expand Explore and Resources. The dialog traps focus, locks background scrolling and returns focus on dismissal. The catalog retains its independent layout.

## Navigation readiness

| Destination                                  | Current behavior and dependency                                                                 |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Home                                         | Public shell with a development-only stage description. Full homepage requires M01.02 approval. |
| For Creators, Brands, Agencies               | Later M01 audience pages. Agency operations require later approval.                             |
| Explore creators / campaigns                 | Public projections depend on M01-F01/F02 and M09/M10 source records.                            |
| Creator guides, growth tips, Brand resources | M01-F04 content inventory pending.                                                              |
| Pricing                                      | M01 public copy; commercial tiers depend on M27.                                                |
| Log in / Get started                         | M02 authentication.                                                                             |
| About, Contact, Support centre               | M01 editorial and support content. M01-F06 delivery pending.                                    |
| Privacy, Terms                               | Legal content and approval pending.                                                             |
| Design system                                | Existing development-only catalog.                                                              |

Development links open an allowlisted readiness page. Production displays pending labels and returns 404 on readiness requests. URLs are internal and carry no external redirect parameter. The shell performs no database or authentication requests. The original route inventory is proposed; final paths, legal copy, resource inventory, public indexing and referral terms remain open. Features, demo, FAQ, content details and referral URLs remain deferred to later M01 work. M01-AC05 has shell coverage. No M01 functional requirement is complete.

## Changed files

Moved the root page to src/app/(public)/page.tsx. Added layout.tsx, public.css and readiness/[id]/page.tsx within that group. Added src/components/public/header.tsx, destination.tsx and src/config/navigation.ts. Updated src/proxy.ts and tests/browser/production.spec.ts. Added tests/browser/public.spec.ts and tests/unit/navigation.test.ts. Updated DEVELOPMENT_STATUS.md and REQUIREMENTS_TRACEABILITY.md. Evidence images are in docs/development/evidence/m01-shell-{1440,768,390}.png.

## Manual acceptance

Review the temporary wordmark, sticky header and footer at the three evidence widths. Try skip navigation, dropdown arrows, Escape and outside click. Open and close the compact dialog by keyboard and touch. Follow a pending destination and return home. Confirm the stage-only content and proposed information architecture. Hosted Supabase and Git commits remain deferred by the owner. M01.02 awaits separate authorization.

## Verification

Frozen installation, formatting, lint, strict typecheck and production build passed. Vitest passed 11 tests. Playwright passed 17 tests including the Phase 00 regression suite; zero final failures or skips. All seven requested widths passed overflow checks. Automated accessibility scans passed for the closed public shell at 390, 768 and 1440px. Initial checks found a mobile label mismatch and a desktop outside-click failure; both were fixed and re-tested. All three screenshots were visually reviewed. The dependency audit found no known vulnerabilities. Manual screen-reader and touch-device acceptance remains pending.
