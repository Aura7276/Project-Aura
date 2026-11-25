# M01 — Public website and navigation

Status: business requirements approved; implementation details proposed.

## Functional requirements

- **M01-F01** Public limited creator profiles with creator-controlled publication.
- **M01-F02** Public limited campaign previews; login and eligibility required to apply.
- **M01-F03** Free to get started; premium capabilities later.
- **M01-F04** Creator guides, growth tips and Brand resources.
- **M01-F05** Interactive walkthrough for Creator and Brand portals.
- **M01-F06** Contact form, email and support centre.
- **M01-F07** Creator referral and invite capability at launch.

Source note: reconstructed from prior decision summaries; numbering is a new local mapping, not an exact transcript. Confirm against original decisions if available.

## User journey
Visitor → audience-specific landing → explore previews or demo → register with referral/campaign context → onboarding.

## Logical data entities
Public profile projection, campaign preview, resource, support request, referral attribution.

## Proposed screen inventory
`/`, `/creators`, `/brands`, `/agencies`, `/explore/creators`, `/creator/[username]`, `/explore/campaigns`, `/campaign/[slug]`, `/features`, `/demo`, `/pricing`, `/resources`, `/resources/[slug]`, `/about`, `/contact`, `/support`, `/faq`, `/invite/[code]`, `/privacy`, `/terms`.

## Business rules and security
Public fields allowlisted: published display name/photo/niche/bio/languages/general location/content and opted-in follower range. No private rates, phone, email, analytics or campaign details. No fake endorsements, counts or opportunities. Referral abuse controls; reward policy M27.

## Acceptance and negative tests
- M01-AC01: Anonymous visitors see only approved public fields.
- M01-AC02: Unpublished or suspended resources cannot be fetched by direct URL.
- M01-AC03: Campaign CTA carries campaign context through authentication.
- M01-AC04: Referral attribution persists and duplicate/self-referral abuse is controlled.
- M01-AC05: Real navigation and accessible responsive empty states work.

## Outstanding decisions / dependencies
Exact referral rewards, content inventory, public indexing and final routes remain open.
