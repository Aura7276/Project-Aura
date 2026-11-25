# M01.03 · Public Creator landing page

Open http://127.0.0.1:3101/creators. Status: Awaiting manual acceptance.

## Experience

Hero with registration readiness and a same-page studio link; Creator challenges; fixed illustrative AI coaching; social analytics and growth experiments; content planning; professional identity and media kit; six phased collaboration categories; audience stages and UGC eligibility; commercial coordination and external payment tracking; five-step Creator journey; ten expandable FAQs; closing registration entry. Growth, Analytics and Content tabs switch between authored examples and support keyboard navigation. The page uses shared navigation, footer, buttons, tabs, tokens and production isolation.

Desktop, tablet and mobile full-page evidence: [1440](evidence/m01-creators-1440.png), [768](evidence/m01-creators-768.png), [390](evidence/m01-creators-390.png).

## Changes and dependencies

Added the Creator route and scoped stylesheet under src/app/(public)/creators, the reusable visual-slot component and the shared collaborations copy. Updated navigation configuration, destination component, old readiness page and homepage conversion entries. Updated homepage image delivery with a mobile derivative of the approved existing asset. Added Creator browser tests and updated navigation unit, homepage and production regressions. Updated AGENTS.md, asset, status, traceability, dependency, readiness and decision registers. No new runtime dependencies.

M01-F03/F05 receive public copy and illustrative preview coverage only. Real registration depends on M02/M03, publication on M09 and commercial workflows on their approved modules. No M03–M13 business capability was implemented. Hosted Supabase and Git operations remain owner-deferred.

## Manual acceptance

Inspect the placeholder and media-kit composition at three widths; try the studio keyboard controls and ten FAQs; follow Creator entries from desktop, mobile, homepage and footer; review the eligibility, rollout and external-settlement language; confirm the intended production registration treatment. Owner approval is required before M01.04.

## Verification and performance

Frozen install, formatting, ESLint, strict type checking and the production build passed. Vitest passed 11 tests and Playwright passed 28, with zero failures or skips. The suite exercised all eight requested widths, the development and production Creator entry routes, readiness isolation, interactive tabs and FAQs. Automated axe scans passed at 390, 768 and 1440px. All three full-page captures were inspected. Dependency audit found no known vulnerabilities.

The previous homepage Lighthouse trace identifies the hero image as LCP, with resource transfer the largest observed subpart (401ms, versus 302ms server response). Mobile now requests a pre-cropped 750 × 536 AVIF of the approved local photo (34,063 bytes), eagerly at high priority. The desktop keeps the approved original and responsive Next Image delivery.

Lighthouse 13.6.0, default simulated mobile throttling, local production server, one run per route. Homepage performance 93 (previously 88), LCP 2.9s (previously 3.6s), TBT 160ms (previously 150ms), CLS 0. The homepage missed the 2.5s LCP target. Creator page performance 87, LCP 1.0s, TBT 510ms and CLS 0.019. The Creator page missed the score target of 90. These are lab observations; deployed field performance and manual assistive-technology acceptance remain pending.
