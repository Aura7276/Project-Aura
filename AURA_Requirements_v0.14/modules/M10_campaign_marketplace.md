# M10 — Campaign marketplace

Status: business requirements approved; implementation details proposed.

## Functional requirements

- **M10-F01** All six campaign categories: Paid, UGC, Barter, Affiliate, Ambassador, Events.
- **M10-F02** Browse ineligible campaigns with explanations; block ineligible applications.
- **M10-F03** Below 100 prioritize UGC/non-influencer opportunities; restricted influencer campaigns for awareness.
- **M10-F04** Public, restricted and invitation-only visibility.
- **M10-F05** International discovery subject to geography, language, payment and eligibility.
- **M10-F06** Personalized For You and searchable category-filtered marketplace.
- **M10-F07** Commercial filters including compensation, rights, exclusivity, travel and deliverables.
- **M10-F08** Bookmarks, saved searches and configurable alerts.
- **M10-F09** Compare compensation, effort, deliverables, rights and eligibility.
- **M10-F10** Reversible Brand/category hiding and blocking.
- **M10-F11** Separate mandatory eligibility from explainable relevance.
- **M10-F12** Separate hard requirements and preferred attributes.
- **M10-F13** Explain matching factors, missing data and limitations.
- **M10-F14** Verification not automatic universal ranking advantage.
- **M10-F15** Relevant beginner-friendly opportunities and diversity-aware recommendations.
- **M10-F16** Revalidate at application and agreement acceptance.
- **M10-F17** Monetary amount or meaningful range before application; negotiable terms labelled.
- **M10-F18** Separate products, services, experiences, commissions and guaranteed money.
- **M10-F19** Disclose rights/exclusivity or identify negotiable terms.
- **M10-F20** Actual available positions or explicitly undisclosed.
- **M10-F21** Optional actual aggregate applicant counts with privacy thresholds and Brand settings.
- **M10-F22** Material change history and notifications.
- **M10-F23** AI assesses relevance, workload, compensation, rights and conflicts.
- **M10-F24** Label estimated effort/suitability with supporting context.
- **M10-F25** Highlight missing terms and suggest questions.
- **M10-F26** AI drafts only; explicit application approval.
- **M10-F27** Approved business verification before public campaign publication; M14 extends to all formal campaigns.
- **M10-F28** Risk-based moderation and flagged review.
- **M10-F29** No Brand application fees or unlock deposits.
- **M10-F30** Structured reporting, blocking, review and tracking.
- **M10-F31** Genuine Brand history, verification and eligible feedback; no unsupported score.
- **M10-F32** Configurable new opportunity, deadline and change alerts.
- **M10-F33** Future labelled promoted placements never override eligibility.
- **M10-F34** Core discovery and eligible applications free initially.
- **M10-F35** Explain empty results and offer improvements/alerts.

## User journey
Discover → filter/compare → view brief and eligibility → optional AI review → save/apply → revalidate → M11.

## Logical data entities
Campaign, campaign version, requirement, compensation, deliverable definition, rights, visibility grant, eligibility result, bookmark, saved search, recommendation, report.

## Proposed screen inventory
`/creator/marketplace`, `/for-you`, `/explore`, `/category/[type]`, `/[id]`, `/[id]/eligibility`, `/[id]/assessment`, `/saved`, `/recent`, `/compare`, `/searches`, `/alerts`, `/[id]/updates`, `/preferences` (marketplace-relative), `/brand/[slug]`, report modal, application entry.

## Business rules and security
Mandatory eligibility independent of ranking. Conditional requirements checked at correct stage. Public previews limited; private campaign direct URL cannot bypass grant. No fabricated counts. Material changes do not amend accepted agreement. M14 requires business verification for all formal publication/outreach.

## Acceptance and negative tests
- M10-AC01: Visibility and eligibility enforced at API and DB boundaries.
- M10-AC02: UGC can qualify without influencer follower minimum.
- M10-AC03: Compensation types and actual counts accurately labelled.
- M10-AC04: Material version changes notify affected users.
- M10-AC05: Unverified Brand cannot publish any visibility type.
- M10-AC06: AI cannot apply; blocking/reporting and empty states work.

## Outstanding decisions / dependencies
Matching weights, privacy thresholds, moderation policy and category sequencing M17/M29.
