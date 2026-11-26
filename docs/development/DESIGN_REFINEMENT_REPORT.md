# M01–M06 design review

Branch: feature/m01-m06-design-refinement. Base: 4d124df. Status: In progress.

## Visual evidence

The before and after directories under evidence/design-refinement contain Chromium viewport captures and route manifests for 69 page patterns. All captures use anonymous browser contexts. Each manifest records the actual landing path. Forty-one after captures landed at login, including the login route itself. Three intentionally unknown public records or readiness identifiers returned 404. Protected-page redirects demonstrate anonymous access handling only. Seven representative layouts additionally fit 390px and 768px viewports. Development previews supplied the onboarding and dashboard views. M05 and M06 authenticated visual acceptance is outstanding.

Compare home.jpg, login.jpg and dev-studio-preview-dashboard.jpg across the two directories. The review led to shortening the account-form controls, adding a separate dashboard heading region, simplifying notification emphasis, structuring the resource index, and turning multi-paragraph analytics empty states into vertical layouts. The defaults for future modules live in ../architecture/DESIGN_SYSTEM.md.

## Research and tools

The public pages of Linear and Attio informed compact navigation and grouped product sections. Framer and Raycast informed the use of a single focal point. Stripe, Vercel and Notion informed information hierarchy. Superhuman, Later and Buffer were reviewed for product and audience entry points. The reference review used publicly available web content. Awwwards, Land-book, SaaSFrame, Mobbin and Behance were requested as secondary sources; no private product screens were used as evidence.

The Frontend Design and Frontend App Builder instructions informed editorial typography and browser comparisons. The owner excluded generated concept imagery. UI/UX Pro Max informed responsive and accessibility checks. Vercel Web Design Guidelines informed icon naming and focus. Playwright and Webapp Testing informed the before/after Chromium capture workflow using the existing Node test stack.

## Verification

Frozen install, lint, strict type checking and production build passed. The package audit reported no known vulnerabilities. Unit results: 166 passed and 45 database tests skipped. A Windows path-normalization issue in the route-inventory test was corrected. Browser results: 132 passed and 3 failed in the full run; all 3 passed on an isolated rerun. Two failures involved missing browser trace files during parallel test commands; one involved an interrupted page context. The stack suite could not start without PostgreSQL. Repository-wide format checking reported 172 files with formatting warnings during the run.

## First hosted integration

Use a new hosted Supabase development project. Its managed PostgreSQL database, Auth and Storage support this repo. No local SQL installation is required for the hosted application. In the ignored .env.local, set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY from that project's Connect dialog. Keep the local AURA_SITE_URL. Follow M02_AUTHENTICATION.md for the Auth URL allow-list, MFA, mail templates and OAuth. Authenticate the Supabase CLI locally, link the development project, review supabase db push --dry-run and apply the five versioned migrations in order. The M05 migration prepares the private social-evidence storage bucket. Restart the dev server and run pnpm supabase:check. Then verify registration, onboarding, workspace isolation and private routes with controlled accounts. Live configuration and email delivery remain unverified.

## Task-first redesign follow-up

The homepage now opens on the approved studio photograph with two audience entrances. The public studios retain their interactive previews and group secondary topics in disclosures. The help index routes directly to account creation, recovery, privacy, FAQs and contact. Registration places Google and email flows separately and defers the optional phone field. Creator onboarding leads with progress and the resume action. The dashboard shows its first two personalized widgets and offers the remainder under “More from your workspace.” Analytics defers custom dates, and social account empty states direct creators toward recording their first account.

Desktop Chromium counts of words in the main region with default disclosures closed:

| Route                  | Previous | Revised | Reduction |
| ---------------------- | -------: | ------: | --------: |
| Homepage               |      400 |     102 |       75% |
| Creators               |      524 |     166 |       68% |
| Brands                 |      611 |     181 |       70% |
| Support                |       70 |      26 |       63% |
| Illustrative dashboard |      588 |     271 |       54% |

The final route capture recorded 66 successful responses and three expected unknown-record 404s across 69 patterns. Protected routes led to login. These captures do not establish authenticated visual acceptance for M05 or M06. The application passed lint, strict type checking and the production build. The unit suite recorded 166 passes and 45 skipped database tests. The browser suite initially recorded 128 passes and seven failures. Targeted reruns passed all seven after disclosure interactions and stale text assertions were corrected.
