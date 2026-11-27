# Decision register

| Decision                                                                                                            | Basis or owner                                                       | Disposition                                            |
| ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------ |
| Build at the inspected workspace root, retain the handover in place                                                 | Phase 00 instruction; older path in development plan is illustrative | Implemented                                            |
| Use local IDs for M01–M03 and preserve decision order for M04–M14                                                   | v0.14 README and consolidated requirements                           | Implemented in traceability                            |
| Registration and growth access below 100 followers; standard influencer eligibility requires one qualifying account | M03 clarified by M04/M05. UGC is separate.                           | Accepted business baseline; implementation Not started |
| Verified Brand required for formal publication and outreach; MFA extends to designated privileged roles             | M14 clarifies earlier M02/M10/M11 language                           | Accepted business baseline; implementation Not started |
| Choose modular monolith, npm-distributed local fonts, a development-only catalog and no demo backend                | Engineering choices for Phase 00                                     | Awaiting manual acceptance                             |
| Use port 3101 for inspection                                                                                        | Port 3000 already had a listener                                     | Implemented                                            |
| Select a real local or dedicated staging Supabase environment                                                       | Product owner / environment operator                                 | Blocked pending access                                 |
| Accept Phase 00 and authorize M01 separately                                                                        | Product owner                                                        | Awaiting manual acceptance                             |

The historical release stages and legacy PRD predate the v0.14 module sequence. Future Agency/Admin features, integrations and commercial actions require their own decisions. The original transcript and numbering for M01–M03 are unavailable. Routes, state machines, entity designs, MVP subsets and negative tests in the handover remain proposals. Before M01 resolve referral policy, indexing, public routes and resource content as needed. See the full per-module decision and dependency list in [baseline register](../../AURA_Requirements_v0.14/16_DECISION_REGISTER.md).

M01.02 retains the approved hero headline. Development audience entries use readiness pages; production entries target the matching homepage journey. Category rollout remains an owner decision.

## M01.03 owner decisions

M01.02 received conditional technical acceptance. Through M14, retain approved assets and use registered CSS/SVG/Lucide/typography placeholders, neutral avatars and interactive UI previews. Defer decorative acquisition, external image URLs and image generation to separate visual refinement. Preserve responsive slots so artwork replacement is independent of business logic.

Owner clarification from later M17 decisions supersedes the earlier public sequencing proposal: paid influencer, UGC and barter first; events and ambassador next; affiliate depends on attribution readiness. Use this wording on both public pages. The original v0.14 handover remains intact. Commercial workflows are pending.

## M01.04 owner direction

M01.03 received conditional technical acceptance. Supplementary Brand Growth OS decisions for M14–M22, campaign operations, reporting, commercial budgets and delegated Agency representation authorize marketing positioning only. V0.14 is preserved. M01.05 requires separate approval.

## M01 module delivery

Owner replaced page-by-page gates with one M01 delivery cycle. Preserve main at the local baseline; work on feature/m01-complete-public-website. No merge, push or M02 authorization. Resource articles are editorial guidance. Legal texts, referral rewards and support mailbox require owner or responsible-module input.

## M02 authorization and policy

The owner authorized M02 on its feature branch. Privileged application operations verify real provider sessions and database memberships. The user-facing flow records adult self-attestation. The exact commercial mobile-verification triggers, assisted account recovery procedure and session retention period still require owner decisions. These settings must be reviewed before release.

## M03 Creator onboarding proposals

Proposed for owner confirmation. The mandatory minimum is Creator name, country, language and self-identified stage; a primary niche or "still exploring"; and at least one goal category. All else is optional. A "relevant individual account" is one the Creator declares as their own rather than a Brand or company page, and the 100-follower rule applies to the single best such account, never a sum. UGC eligibility is shown as needing assessment until criteria are approved. Creator profiles are constrained to private until M09. The AI path is reported unavailable until M07. Screenshot upload is disabled until private storage and scanning exist. The 90-day reminder is a placeholder. Retention of private onboarding data needs an owner decision. M02's migration defect (`end $;`) must be fixed on its branch.

## M04 Creator dashboard proposals

Proposed for owner confirmation. Dashboard personalization is rule-based and orders widgets by the Creator's account situation (no account, follower counts unknown, below 100, qualifying) and UGC focus. It never grants access or eligibility, and growth widgets always precede the commercial overview. Daily actions are three to five rule-based suggestions generated once per local day. Milestones are first-time real events only (workspace activated, first action, first observation, first idea), with no thresholds. The streak is consecutive local days with a completed action, with no penalty text. Weeks run Monday to Sunday in the stored time zone, and observations are stale after 14 days. The default time zone is Asia/Kolkata. The weekly email digest is a stored preference only until M25 exists. The commercial overview shows "not available" until M13 records exist. Search covers the Creator's own records, tools and the three public guides, and stores no queries. Observations are keyed by goal category and metric so that editing goals never erases history.

## M05 social account proposals

Proposed for owner confirmation. Limit of 10 accounts (configurable). Challenge TTL 72 hours, 5 attempts. Weekly in-app reminder after 7 days; no email until M25. Freshness windows are metric-specific. Evidence upload is off until a private bucket and malware scanner exist. Manual metrics are always labelled self-reported. Removing an account frees a slot and keeps history; retention needs an owner decision. Reviewers are Platform Admins with an explicit grant and MFA; no self-approval. Provider platform support is proposed and unverified.

## M06 analytics proposals

Proposed for owner confirmation. Baseline tolerance is `min(14, max(3, period/4))` days. Previous-period comparison is blocked when observation coverage differs by more than about 40 percent. Pattern analysis needs at least 3 items per group and at least two groups on one shared measurement basis; 8 or more per group is "suggestive", otherwise "exploratory". Timing suggestions are labelled low or moderate and never high. Scenario ranges need 8 observations over 56 days with no gap over 21 days. Maximum 3 active experiments per workspace. Peer cohorts need opt-in and at least 10 (default 25) comparable creators. Insight priority orders attention only and is not a score. Core features free; pattern, timing, scenario, cohort and PDF features are marked advanced but not gated (M27). Retention of experiments, insights, audience snapshots and export logs is undecided. A Brand export route exists in the database only.

## M09 profile and media kit proposals

Proposed for owner confirmation. Public profiles stay at `/creator/[username]` (approved screen inventory); every Studio route word is reserved as a username instead of moving the public path. Usernames: 3 to 30 characters, lowercase letters, digits, dot, dash, underscore, no doubled punctuation; old names redirect and stay protected for 30 days; 3 changes per 30 days. F04 reading: a Creator below 100 followers may publish for direct sharing; only discovery requires a qualifying account. Restricted kit links expire after 30 days by default (maximum 365); public links have no default expiry. Rates are never public; packages and audience appear only in restricted links. Testimonials need an invitation (30 days, single use), moderation by an MFA reviewer and the Creator's choice to display. QR codes use a dependency-free encoder (level M, versions 1 to 10). Branding removal is free until M27 decides. Analytics retention is undecided.

## M10 marketplace proposals

Proposed for owner confirmation. Until M14 exists, business verification is an interim decision by a restricted platform reviewer (Platform Admin + reviewer grant + MFA, reason required, no self-review), stored in the existing M02 `workspace.verification` field; M14 replaces the process. Restricted visibility means visible only to Creators who meet every mandatory requirement; invitation-only means visible only to invited Creators. A Brand's first publication, fee language, off-platform contact details and exclusivity over 180 days are held for human review. Applicant counts appear only above 10 and only if the Brand allows it (applications are M11). Exclusivity is capped at 365 days. For You orders by shown factors with no score and at most two campaigns per Brand on the first page. Deadline alerts are computed when read (3 days); there is no scheduler yet.

## M11 applications proposals

Proposed for owner confirmation (non-production defaults in `aura_apply.setting`): an application locks at the Brand's first action (review, question or decision); invitations expire after 14 days; proposals are valid for 7 days (1 to 30); clarifications are due in 5 days; a Creator may reapply once after their own withdrawal, or any time when the Brand allows it; 20 applications, 50 invitations and 30 enquiries per day, 30 messages per hour; up to 10 screening questions of at most 1,000 characters; short reportable messages beside structured proposals; Agencies have no access until a delegation model is approved; Brands find Creators by published username only.

## M14 Brand onboarding proposals

Proposed for owner confirmation. Required onboarding fields: Brand name, business type, country, intent, objective, stage and experience; everything else optional. Eight business types (individual, sole proprietor, startup, small business, D2C, company, enterprise, international) with the evidence matrix in `aura_brand.setting` (company types: legal name, registration number, registered address, representative name and role; individuals: representative, identity document type and last 4 characters, address; international adds country of registration). Evidence is typed details only until file uploads exist. One appeal per rejection within 30 days, decided by a different reviewer. A legal identity change pauses publishing and outreach until revalidated; existing obligations stay. A public profile needs an approved verification, an about text of at least 40 characters and a unique address. Five cases per workspace per day. Brand social accounts are manual and self-reported. The Brand header (Home, Business, Verification, Campaigns, Inbox) is a minimal private landing pending M15.

## M12 build-only authorization — 26 November 2026

The owner explicitly authorized M12 and requested no tests or validation. This overrides the routine test procedure for this implementation pass. Review M12_COLLABORATION_WORKSPACE.md for actual delivery and outstanding policies. Use participant-scoped shared workspaces, exact submission versions, explicit bilateral acceptance and independent settlement state. Keep original agreements immutable. Legal-template approval is required for live activation and amendment acceptance. Selected Content Studio text is copied only after explicit Creator confirmation. File upload, legal retention, dispute escalation and Agency delegation decisions remain open.

## M13 build-only implementation — 27 November 2026

The owner authorized a premium M13 workspace. The continuing build-only instruction defers tests and validation. Use exact decimal strings, SQL numeric and BigInt for money; reject excess precision without rounding. Current engineering bounds are 12 whole and 6 fractional digits, pending currency-specific policy. Keep private external records separate from shared payment reports. Confirmed report import requires explicit Creator action; bilateral reversal affects only the matched receipt. Invoice issue protects the snapshot and does not duplicate the obligation. Tax-specific compliance, credit notes, reimbursements, retention, FX and automated recurring schedules remain unresolved. See M13_COMMERCIAL_WORKSPACE.md.

## M15 recovered-scope authorization — 27 November 2026

After a read-only context review disclosed the incomplete 45-item specification, the owner authorized building a premium M15 dashboard. This supersedes historical non-authorization for the recovered scope only. Preserve the source reconstruction and do not invent original requirement identifiers. Use manual private focus until M14 data exists. Owners/admins edit the shared plan; other members read pending M26 role decisions. Keep private workspace routes under /brand/workspaces/[id] to preserve the proposed public Brand slug route. The continuing build-only instruction defers tests and validation.

## M17 campaign proposals

Proposed for owner confirmation, because the module file is a partial reconstruction: build M17 on the M10 store; publishable now: paid influencer, UGC, barter; draft-only until opened: events, ambassador, affiliate; campaign plans (objective, KPI, audiences, products, owner, milestones, notes) are private; at most 12 milestones; drafts may be incomplete, publication requires completeness; only drafts and closed campaigns can be archived; budgets stay a range on the campaign until M22; the M11 to M12 agreement link is a separate task.

## M18 selection proposals

Proposed for owner confirmation (the module file is a partial reconstruction): a hold lasts 72 hours and ends when the Creator accepts (the negotiation follows); holds count against positions and selection capacity; declining a place withdraws the application; expiry is evaluated on read until a scheduler exists; comparison takes 2 to 4 candidates; bulk actions are review, shortlist and reject (never selection), up to 50 at once; notes and tags are private to the Brand; the M11 → M12 hand-off creates an "Agreement pending" workspace whose acceptance needs an approved legal template.
