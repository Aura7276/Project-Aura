# M14 — Brand onboarding

Status: business requirements approved; implementation details proposed.

## Functional requirements

- **M14-F01** Individual owners, startups, small businesses, D2C, established and eligible international businesses.
- **M14-F02** Businesses starting with zero social presence can join.
- **M14-F03** Short mandatory onboarding then progressive completion.
- **M14-F04** Multiple separate Brand workspaces per identity with independent permissions/data/verification.
- **M14-F05** Personalize by business stage, experience and resources.
- **M14-F06** Creator marketing, owned social growth or both.
- **M14-F07** Editable primary objective without restricting eligible features.
- **M14-F08** Measurable awareness, social growth, content, engagement and supported conversion goals.
- **M14-F09** Structured maturity assessment without arbitrary score.
- **M14-F10** Separate legal entity, trading name and public professional identity.
- **M14-F11** Reusable product/service catalogue, approved claims, images, customers and campaign links.
- **M14-F12** Permitted website retrieval and AI extraction with confirmation.
- **M14-F13** Optional logos, guidelines and assets with controlled access.
- **M14-F14** AI proposes colours, tone, positioning and characteristics for confirmation.
- **M14-F15** Multiple customer segments for products, markets and campaigns.
- **M14-F16** AI personas distinguish confirmed facts from hypotheses.
- **M14-F17** Lawful structured geography, language, interests and buying considerations.
- **M14-F18** Save competitor references; advanced monitoring future permitted-data feature.
- **M14-F19** Optional indicative budget/range; required for applicable commercial campaigns.
- **M14-F20** Optional creator and owned-content budget allocations, no commitments.
- **M14-F21** Optional team, equipment, production and Agency information.
- **M14-F22** Beginner guidance, pilot campaign suggestions and learning resources.
- **M14-F23** Reuse M05 infrastructure with independent Brand accounts/analytics/permissions.
- **M14-F24** Maximum 10 social accounts initially per Brand workspace.
- **M14-F25** Manual and screenshot-assisted confirmed source-labelled observations.
- **M14-F26** Brand tone, visual identity, claims, exclusions and preferences.
- **M14-F27** Optional Creator niche, formats, languages, platforms, geography and experience preferences.
- **M14-F28** Explain suitable Creator segments and UGC capabilities.
- **M14-F29** Brand preferences editable defaults, not mandatory campaign rules.
- **M14-F30** Configurable industry/competitor conflicts with transparent campaign restrictions.
- **M14-F31** Unverified Brand private planning, AI, analytics and campaign drafts; commercial actions restricted.
- **M14-F32** Risk-based evidence for individuals, proprietors, companies and international businesses.
- **M14-F33** Domain or website verification only supporting evidence.
- **M14-F34** All formal public/restricted/invitation-only campaign publication and invitations require approved business verification.
- **M14-F35** Unverified Brands cannot send preliminary commercial enquiries; public browsing and private preparation allowed.
- **M14-F36** Revalidate material legal identity or ownership changes.
- **M14-F37** Structured rejection, resubmission, review history and applicable appeal.
- **M14-F38** Optional team invitations with RBAC.
- **M14-F39** MFA mandatory for owners, administrators and designated privileged commercial roles.
- **M14-F40** Optional Agency relationship; actual access explicit M23 delegation.
- **M14-F41** Persistent editable authorized Brand intelligence profile.
- **M14-F42** Structured onboarding plus optional AI conversation and confirmed updates.
- **M14-F43** Personalized plan, setup checklist, relevant Creator recommendations and learning resources.
- **M14-F44** Editable 7-, 30-, 90-day growth plans.
- **M14-F45** Save incomplete onboarding; permit available tools and gate affected features.
- **M14-F46** Private Brand profile until explicit eligible publication.
- **M14-F47** Creators see published data and designated campaign disclosures only.
- **M14-F48** No shared model training by default; separate explicit authorization for future use.
- **M14-F49** Free registration/basic onboarding; subscriptions/advanced tools M27.
- **M14-F50** Configurable update reminders, editable information and authorized refresh.

## User journey
Create workspace → basic identity/objective → customers/goals/resources → eligible private workspace → enrich catalogue/guidelines/social data → verify → unlock eligible commercial actions.

## Logical data entities
Brand workspace/profile/legal entity/representative, onboarding, objective/goal, maturity, product/claim, segment/persona, guideline/asset, social account, indicative budget, creator preference, competitor, verification case/evidence/decision, intelligence profile, growth plan, Agency relationship, membership.

## Proposed screen inventory
`/brand/onboarding`, `/objectives`, `/identity`, `/products`, `/audience`, `/goals`, `/maturity`, `/budget`, `/socials`, `/creators`, `/guidelines`, `/assistant`, `/review`, `/plan`, `/complete` (onboarding-relative); `/brand/verification`, `/brand/profile`, `/brand/intelligence`, `/brand/products`, `/products/[id]`, `/brand/audiences`, `/brand/guidelines`, `/brand/competitors`, `/brand/socials`, `/brand/preferences/creators`, `/brand/profile/privacy`, `/brand/[slug]`; evidence, resubmission, invite panels.

## Business rules and security
No Creator 100-follower threshold for Brands. Verification per workspace; no public/private outreach bypass. Legal identity changes revalidate. Existing obligations not erased by revocation. Public identity distinct from legal evidence. AI imports are drafts pending confirmation.

## Acceptance and negative tests
- M14-AC01: Zero-social Brand can use private growth/planning.
- M14-AC02: Multiple workspaces cannot access each other’s information.
- M14-AC03: Unverified Brand blocked from all campaign publishing/invites/enquiries.
- M14-AC04: Verification for one workspace does not verify another.
- M14-AC05: Privileged MFA enforced; Agency label grants no access.
- M14-AC06: AI extracted claims/personas require confirmation and provenance.
- M14-AC07: Budget optional at onboarding, no spend commitment.
- M14-AC08: Account limit 10 and private-by-default publication enforced.

## Outstanding decisions / dependencies
Exact mandatory fields, verification document matrix/appeal/revalidation, existing contracts after revocation, role matrix M23/M26/M29 and M15 dashboard approval pending.
