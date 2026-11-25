# M01.02 · Homepage

Awaiting manual acceptance. Inspect http://127.0.0.1:3101/. M01 remains In progress.

## Section inventory

Editorial hero with two audience entries; three-part product positioning; switchable illustrative studio preview; Creator and Brand growth journeys with their respective four-step workflows; collaboration categories and an honest empty listing state; audience stages and planned Agency Studio; seven expandable FAQs; closing Creator and Brand entries. The existing public shell and footer surround the page. The headline follows the approved design system.

## Scope and traceability

M01-F03 public free-start guidance and M01-F05 illustrative audience preview are partial. Operational entitlements and the full portal walkthrough remain deferred. M01-F01/F02 public projections and campaign feeds require real published data. M01-F04/F06/F07 remain open. Hero and closing CTAs use existing development readiness destinations. In production they navigate to the corresponding on-page journey until approved landing pages exist. M10 approves six categories and leaves sequencing open; paid influencer work and UGC are presented as a proposal pending owner confirmation.

## Changes and assets

Updated src/app/(public)/page.tsx and added home.css alongside it. Added public/images/home/studio.webp, an original generated editorial illustration. See ASSET_PROVENANCE.md for provenance and processing. Updated src/components/public/header.tsx to focus the first enabled dropdown item when keyboard entry would otherwise leave focus on the menu container. Added tests/browser/home.spec.ts and updated public.spec.ts evidence filenames and production.spec.ts heading expectation. Updated development status, traceability, decision and dependency registers. Added this report and the asset register.

Full-page Chromium screenshots: [desktop](evidence/m01-home-1440.png), [tablet](evidence/m01-home-768.png), [mobile](evidence/m01-home-390.png). Browser checks covered 320, 360, 390, 430, 768, 1024, 1440 and 1920px.

## Verification

Frozen install, formatting, ESLint, strict TypeScript and production build passed. Vitest: 11 passed. Playwright: 18 passed, zero final failures or skips. Two preceding browser runs each had one desktop keyboard focus failure, fixed in the header. Automated axe scans passed at the three screenshot widths. The tests exercise keyboard FAQs, studio tabs, loaded hero media, reduced-motion mode, internal destinations, production preview denial and CSP. Dependency audit reported no known vulnerabilities. No hosted service access is required.

A local production mobile Lighthouse 13.6.0 run measured performance 88/100, LCP 3.6s, CLS 0 and TBT 150ms. This single lab measurement includes the visual homepage before the final menu-focus adjustment. Hosted performance and device/assistive technology review remain unverified. [Measurement](evidence/m01-home-performance.json)

## Owner acceptance

- Inspect the hero photo crop, typography and CTA hierarchy across phone, tablet and desktop.
- Review the India-first positioning, marketplace sequencing proposal and planned Brand/Agency language.
- Check both audience entries, keyboard tabs, FAQs and navigation with a physical touch device and a screen reader.
- Record acceptance or requested revisions before authorizing M01.03. Git and hosted Supabase remain owner-deferred.
