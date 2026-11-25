# M05 — Social media account management

Status: business requirements approved; implementation details proposed.

## Functional requirements

- **M05-F01** Maximum 10 social accounts initially, expandable later.
- **M05-F02** One overall primary and optional preferred per platform.
- **M05-F03** At least one relevant individual account with 100+ followers; campaign-specific eligibility separate.
- **M05-F04** Private accounts accepted for growth; discovery and campaign privileges may be restricted.
- **M05-F05** Profile challenge and optional screenshots, manual review when required.
- **M05-F06** Only one active verified owner; disputes and duplicates reviewed.
- **M05-F07** Unverified accounts may appear in eligible discovery with clear self-reported/unverified labels.
- **M05-F08** Ownership mandatory before accepting designated paid influencer collaborations; UGC separate.
- **M05-F09** Update metrics anytime, weekly reminders, historical snapshots.
- **M05-F10** Account-level and content-level observations.
- **M05-F11** AI-assisted screenshot extraction requires creator confirmation.
- **M05-F12** Observation date, source and metric-specific freshness.
- **M05-F13** Creator controls each account’s visibility.
- **M05-F14** Brands receive published relevant metrics and summaries; additional permission for detailed insights.
- **M05-F15** Removal immediately removes discovery; private eligible history subject to retention/deletion.
- **M05-F16** Instagram integration first, then YouTube and others by demand.
- **M05-F17** Future automatic daily refresh where supported and rate-limited manual refresh.
- **M05-F18** Disconnect stops collection, revokes access where supported, permitted history marked stale.
- **M05-F19** Future opt-in publishing with explicit approval and supported API permissions.
- **M05-F20** Shared infrastructure for Brand accounts with separate permissions and analytics.

## User journey
Add account → set visibility/primary → record observations → optional ownership challenge → review → publish permitted metrics → update/remove/disconnect.

## Logical data entities
Social account, account claim, challenge, verification evidence, observation, content observation, source, visibility, integration credential reference, refresh job.

## Proposed screen inventory
Proposed `/creator/socials`, `/creator/socials/new`, `/creator/socials/[id]`, `/creator/socials/[id]/verify`, `/creator/socials/[id]/metrics`, `/creator/socials/[id]/history`, `/creator/socials/settings`; analogous Brand routes.

## Business rules and security
Unique active verified claim enforced atomically. No unauthorized scraping; do not request social passwords. Self-reported metrics not verified by ownership alone. Revoked visibility invalidates discovery, search and cached outputs.

## Acceptance and negative tests
- M05-AC01: Limit and primary uniqueness enforced under concurrent writes.
- M05-AC02: Duplicate ownership claims go to review without taking over account.
- M05-AC03: Screenshot suggestions do not become observations before confirmation.
- M05-AC04: Private account and removal controls apply to discovery.
- M05-AC05: Disconnect stops jobs; stale data labelled; cross-tenant claims protected.

## Outstanding decisions / dependencies
Verification challenge details, freshness thresholds, retention, platform adapters and provider approval pending.
