# Screen inventory — proposed routes, not final URL contract

## M01 — Public website and navigation
`/`, `/creators`, `/brands`, `/agencies`, `/explore/creators`, `/creator/[username]`, `/explore/campaigns`, `/campaign/[slug]`, `/features`, `/demo`, `/pricing`, `/resources`, `/resources/[slug]`, `/about`, `/contact`, `/support`, `/faq`, `/invite/[code]`, `/privacy`, `/terms`.

## M02 — Registration and authentication
Login, registration, email verification, recovery/reset, workspace selection/creation, invitation acceptance, MFA setup/challenge/recovery, restricted state, session expired, security settings, device history, mobile verification, separately provisioned admin login.

## M03 — Creator onboarding
`/onboarding/creator` with identity, socials, niche, goals, preferences, review, completion, optional AI conversation and progressive profile/checklist screens.

## M04 — Creator dashboard
`/creator/dashboard`, `/creator/actions`, `/creator/progress`, `/creator/recommendations`, `/creator/settings/dashboard`; quick-create, search, notifications, workspace switcher, walkthrough.

## M05 — Social media account management
Proposed `/creator/socials`, `/creator/socials/new`, `/creator/socials/[id]`, `/creator/socials/[id]/verify`, `/creator/socials/[id]/metrics`, `/creator/socials/[id]/history`, `/creator/socials/settings`; analogous Brand routes.

## M06 — Creator analytics and insights
Proposed `/creator/analytics`, `/creator/analytics/accounts`, `/creator/analytics/content`, `/creator/analytics/audience`, `/creator/analytics/compare`, `/creator/analytics/insights`, `/creator/experiments`, `/creator/analytics/reports`.

## M07 — AI Growth Assistant
Proposed `/creator/ai`, `/creator/ai/plans`, `/creator/ai/history`, `/creator/ai/memory`, contextual assistant, action confirmation, usage/status settings.

## M08 — Content ideation and planning
`/creator/content`, `/discover`, `/generate`, `/ideas`, `/ideas/[id]`, `/pillars`, `/calendar`, `/new`, `/[id]`, `/[id]/script`, `/[id]/caption`, `/[id]/storyboard`, `/production`, `/assets`, `/[id]/repurpose`, `/[id]/review`, `/[id]/history`, `/[id]/publish`, `/published`, `/templates`, `/series`, `/settings` (relative to content root where appropriate).

## M09 — Creator profile and media kit
`/creator/profile`, `/profile/edit`, `/profile/appearance`, `/profile/preview`, `/profile/completeness`, `/creator/[username]` public, `/creator/portfolio`, `/portfolio/new`, `/portfolio/[id]`, `/creator/media-kit`, `/media-kit/new`, `/media-kit/[id]/edit`, `/media-kit/[id]/share`, `/media-kit/[id]/history`, `/kit/[slug]`, `/creator/services`, `/creator/rates`, `/rates/packages`, `/profile/experience`, `/profile/reviews`, `/profile/verification`, `/profile/privacy`, `/profile/optimize`, `/profile/analytics`, `/profile/availability` (creator-relative paths).

## M10 — Campaign marketplace
`/creator/marketplace`, `/for-you`, `/explore`, `/category/[type]`, `/[id]`, `/[id]/eligibility`, `/[id]/assessment`, `/saved`, `/recent`, `/compare`, `/searches`, `/alerts`, `/[id]/updates`, `/preferences` (marketplace-relative), `/brand/[slug]`, report modal, application entry.

## M11 — Applications and invitations
`/creator/applications`, `/creator/marketplace/[id]/apply`, `/applications/[id]/edit`, `/applications/[id]/review`, `/applications/[id]`, `/applications/[id]/history`, `/creator/invitations`, `/invitations/[id]`, `/creator/enquiries`, `/enquiries/[id]`, `/creator/negotiations/[id]`, `/creator/settings/applications`; clarification, withdrawal, counterproposal, report and agreement panels.

## M12 — Collaboration and deliverables
`/creator/collaborations`, `/collaborations/[id]`, `/agreement/draft`, `/agreement`, `/agreement/history`, `/brief`, `/deliverables`, `/deliverables/[did]`, `/milestones`, `/calendar`, `/files`, `/messages`, `/changes`, `/performance`, `/rights`, `/activity`, `/disputes/new`, `/disputes/[did]`, `/completion` (collaboration-relative); acceptance, submission/review, amendment, publication/handover, renewal, cancellation, feedback panels.

## M13 — Earnings and commercial management
`/creator/earnings`, `/ledger`, `/ledger/[id]`, `/income/new`, `/clients`, `/payments`, `/payments/[id]`, `/reconciliation`, `/outstanding`, `/expenses`, `/expenses/new`, `/time`, `/reimbursements`, `/barter`, `/affiliate`, `/recurring`, `/goals`, `/profitability`, `/insights`, `/forecast`, `/reports`, `/settings`, `/billing` (earnings-relative); `/creator/invoices`, `/new`, `/[id]`, `/[id]/edit`, `/templates` (invoice-relative); payment/evidence/confirmation/correction panels.

## M14 — Brand onboarding
`/brand/onboarding`, `/objectives`, `/identity`, `/products`, `/audience`, `/goals`, `/maturity`, `/budget`, `/socials`, `/creators`, `/guidelines`, `/assistant`, `/review`, `/plan`, `/complete` (onboarding-relative); `/brand/verification`, `/brand/profile`, `/brand/intelligence`, `/brand/products`, `/products/[id]`, `/brand/audiences`, `/brand/guidelines`, `/brand/competitors`, `/brand/socials`, `/brand/preferences/creators`, `/brand/profile/privacy`, `/brand/[slug]`; evidence, resubmission, invite panels.

## Route convention
Expand relative paths under the named module root; use stable internal identifiers. Resolve public slug conflicts with reserved internal paths using explicit namespace or reserved names. Every screen requires loading, empty, error, stale, restricted and success states as applicable.
