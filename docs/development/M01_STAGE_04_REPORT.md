# M01.04 · Brand landing page

Review http://127.0.0.1:3101/brands. Stage status: Awaiting manual acceptance. M01 remains In progress.

## Page inventory

The hero presents owned-channel growth, content production and creator partnerships. Marketing challenges lead into the integrated ecosystem and four illustrative Brand Studio notes. The following sections introduce the planned AI Brand Growth Assistant and Content Studio, creator discovery and UGC rights, seven campaign workflow steps and the agreed category rollout, separate delivery/performance/settlement measures, commercial management, three business maturity stages, five Brand journey steps, ten FAQs and the closing registration entry.

Brand Studio uses native exclusive disclosures. Each example is authored locally. FAQs use native disclosures and remain available without hydration. On-page studio links work in both environments. Registration follows M02/M14 readiness. No customer records, AI provider, database dependency or commercial actions were introduced.

## Routes, assets and traceability

Both homepage Brand entries and shared navigation lead to /brands. The Creator entry remains live. The reusable VisualSlot retains its fluid 4:3 frame and now accepts a scene caption. The Brand asset register entry identifies the planned marketing-team photograph. No imagery was generated or acquired. Supplementary owner decisions govern public positioning only. The page contributes to M01-F03 and F05; both remain partial. M14–M22 functional implementations remain outside this stage.

## Performance investigation

The previous Creator Lighthouse trace attributed about 810ms of main-thread boot-up work to the document, 512ms to unattributable work and 511ms and 264ms to two bundled scripts. These totals include work beyond blocking time. They do not isolate a single component as the cause. The shared navigation hydrates for focus, menu and dialog handling. Retained those tested interactions and disabled speculative homepage prefetch from the shared wordmark. Replaced the below-the-fold Creator preview’s general Radix tabs with a small purpose-built client component supporting roving focus, arrow keys, Home and End. The remaining Creator sections render on the server. The Brand notes and FAQ use native controls. No new application dependencies.

## Manual acceptance

Review the visual placeholder, planned-capability wording and registration treatment at all capture widths. Exercise the studio, FAQ, navigation and skip link using touch and assistive technology. Confirm verification, rights, campaign sequencing, delegation and external settlement wording. Approval is required before M01.05.

Screenshots: [desktop](evidence/m01-brands-1440.png), [tablet](evidence/m01-brands-768.png), [mobile](evidence/m01-brands-390.png).

## Verified baseline

Frozen installation, formatting, lint, strict type checking, production build and dependency audit passed. 11 unit tests and 38 Chromium tests passed with zero failures or skips. The Brand layout passed overflow checks at all eight requested widths; axe passed at 390, 768 and 1440 pixels. Screenshots were visually inspected. Manual acceptance remains pending.

Three serial local mobile Lighthouse 13.6.0 runs per route used Playwright Chromium headless and default simulated throttling. The standalone Chrome launcher stalled, so these runs used the Lighthouse API attached to fresh browser instances. Earlier single-run results used a different launcher. Per-metric medians follow; underlying samples are in evidence/m01-04-performance.json.

- home — performance 94/100, LCP 3122 ms, TBT 58 ms, CLS 0.002.
- creators — performance 100/100, LCP 913 ms, TBT 45 ms, CLS 0.019.
- brands — performance 100/100, LCP 913 ms, TBT 46 ms, CLS 0.002.
