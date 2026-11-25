# M09 — Creator profile and media kit

Status: business requirements approved; implementation details proposed.

## Functional requirements

- **M09-F01** Dedicated shareable creator website with profile, portfolio, services and media kit.
- **M09-F02** Personalized username and unique URL.
- **M09-F03** Approved themes, cover images, section ordering and featured content.
- **M09-F04** Below 100: private profile and eligible direct sharing; standard influencer discovery restricted.
- **M09-F05** Open, limited or unavailable with optional availability dates.
- **M09-F06** AURA-mediated enquiries; login required; M14 verified Brand outreach required.
- **M09-F07** Organic, genuine commercial work, UGC samples, speculative work and case studies.
- **M09-F08** Label speculative/self-initiated work explicitly.
- **M09-F09** Uploads, permitted links and selected Content Studio records.
- **M09-F10** Optional portfolio metrics with source, date and permissions.
- **M09-F11** Case studies with objectives, approach, contribution, deliverables and supported outcomes.
- **M09-F12** Item-level private/public/restricted visibility and featured status.
- **M09-F13** Media kits populate selected profile data with AI assistance and editing.
- **M09-F14** Shareable web, PDF and QR.
- **M09-F15** Multiple audience-, industry- and service-specific kits.
- **M09-F16** Approved live sections and fixed snapshots.
- **M09-F17** Public, restricted and expiring links with revocation.
- **M09-F18** Multiple professional templates and editable sections.
- **M09-F19** Subtle Created with AURA branding; removal potentially premium.
- **M09-F20** Optional rates, ranges, packages and quote-on-request services.
- **M09-F21** Rates private by default with authorized sharing.
- **M09-F22** Independent UGC services and eligibility.
- **M09-F23** Packages with deliverables, indicative compensation and configurable terms.
- **M09-F24** Optional rates/terms in media kits, restricted where appropriate.
- **M09-F25** External experience self-reported with optional evidence and provenance.
- **M09-F26** Genuine attributable feedback with moderation and disputes.
- **M09-F27** No public composite creator rating.
- **M09-F28** Specific identity, ownership, data provenance and collaboration indicators.
- **M09-F29** AI suggests editable improvements using genuine data.
- **M09-F30** Aggregate profile/kit views, enquiries, link activity and supported conversion analytics.
- **M09-F31** Identifiable Brand visits only with explicit authorization.
- **M09-F32** Private by default; preview, publish/unpublish with eligibility checks.
- **M09-F33** Future custom domains subject to validation.
- **M09-F34** Core profile, portfolio and basic kit free; advanced designs/capacity potentially premium.

## User journey
Build identity → portfolio/services → customize → create kit → review visibility → publish/share → receive verified commercial enquiries → analyze.

## Logical data entities
Profile projection, portfolio item, case study, service, rate card, package, media kit/version/section/share grant, availability, testimonial, view event.

## Proposed screen inventory
`/creator/profile`, `/profile/edit`, `/profile/appearance`, `/profile/preview`, `/profile/completeness`, `/creator/[username]` public, `/creator/portfolio`, `/portfolio/new`, `/portfolio/[id]`, `/creator/media-kit`, `/media-kit/new`, `/media-kit/[id]/edit`, `/media-kit/[id]/share`, `/media-kit/[id]/history`, `/kit/[slug]`, `/creator/services`, `/creator/rates`, `/rates/packages`, `/profile/experience`, `/profile/reviews`, `/profile/verification`, `/profile/privacy`, `/profile/optimize`, `/profile/analytics`, `/profile/availability` (creator-relative paths).

## Business rules and security
Separate private, public, discovery and restricted kit projections. Hosted snapshots enforce current privacy/revocation. Downloaded copies cannot be recalled. No fabricated experience/testimonials; rates not contracts.

## Acceptance and negative tests
- M09-AC01: Profiles private until publication; direct URL cannot bypass restrictions.
- M09-AC02: Item-level permissions respected in kits and exports.
- M09-AC03: Expired/revoked links deny access; QR resolves to correct grant.
- M09-AC04: Sample work labelled; specific verification claims only.
- M09-AC05: Brand outreach requires verification; analytics protect visitor identity.
- M09-AC06: Unpublishing removes authorized discovery/public access.

## Outstanding decisions / dependencies
Username rules, templates, storage, link expiry, PDF architecture and analytics retention pending.
