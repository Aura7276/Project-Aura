# Historical reference — superseded where conflicting

Do not execute as current instructions. V0.14 approved module documents take precedence. This is retained for traceability, not implementation evidence.

# Design system — Creative Premium / Editorial + Product
## Colour tokens
midnight #17152D; violet #7457E8; ivory #F8F6F2; peach #F4B8A6; sage #DCEBE5; white #FFFFFF; text #242137; muted #777486. Ensure AA contrast: violet/peach/sage are not automatically safe for small text on white; use darker semantic text variants when needed.
## Type
Plus Jakarta Sans for display/headings; Inter for UI/body; fluid headings, 16px base body, minimum 14px secondary text; comfortable line-height.
## Geometry
8px spacing system; card radius 16–20px, input 10–12px, pill CTA where appropriate; restrained elevation, subtle 1px borders; max marketing content width ~1200px.
## Layout
Marketing: editorial, warm ivory surfaces, midnight hero/footers, violet CTAs, genuine creator photography or licensed placeholders; no fake brand endorsements. Creator: mobile-first, cards and content thumbnails. Brand/admin: desktop-first, compact tables with responsive alternatives. Agency: multi-client overview.
## Motion
180–320ms functional transitions, tasteful staggered reveal, no scroll-jacking; obey reduced motion. Never make important info animation-dependent.
## Homepage exact sequence
1 Navbar with logo placeholder and Creator/Brand/Agency links + Login/Get started.
2 Hero 'Your creativity deserves more.'; subtitle about growth/opportunities/partnerships; dual Creator and Brand CTAs.
3 Interactive Creator/Brand product preview switch.
4 Creator Growth Lab loop visual: diagnose → experiment → publish → measure → learn.
5 Brand discovery + campaigns feature section.
6 How it works dual-audience steps.
7 Opportunity preview from real published campaigns, or honest empty state.
8 Trust/transparency: profile control, verification review, external settlement disclaimer.
9 Dual final CTA and footer.
## Components
Button, input, select, segmented control, stepper, sidebar, top nav, workspace switcher, profile card, campaign card, metric card, charts, status badge, empty/loading/error state, modal, confirmation, toast, accessible form fields.
## Avoid
Generic neon gradients everywhere, emoji as icons, endless floating blobs, fabricated social proof, overcrowded dashboards, autoplay sound/video, tiny low-contrast copy.

## Production UI states
All pages must implement loading, empty, error, success, permission denied and stale data states. Do not use static metric counts. Brand and Creator landing screens should show onboarding progress and actionable next steps when empty. Public campaign showcase only from live published, eligible records. No made-up creator testimonials.
## Accessibility
WCAG 2.2 AA target, keyboard focus, semantic headings, contrast check, form errors, reduced motion, responsive 360/768/1440px. No fake trust seals.
