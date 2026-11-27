# M16 — Creator Discovery and Intelligence

Status: **partial reconstruction for owner reconciliation; not a complete approved specification.**

Historical tracker: 50 functional requirements approved/reported. Exact original numbered list not recovered; the entries below are not a replacement for those IDs.

## Scope
Discover and evaluate Creators using authorized profile information and campaign relevance rather than follower count alone.

## Recovered requirements and established cross-module constraints
- Consume published M09 Creator projections and expressly authorized M05/M06 aggregate insights.
- Separate mandatory eligibility from preferred attributes and explain relevance, missing data and limitations.
- Standard influencer eligibility requires 100+ followers on one relevant individual account; UGC capability is evaluated separately.
- Support discovery by niche, platform, geography, language, format, capability, available portfolio and permitted follower bands.
- Use self-reported, ownership-verified and provider-derived indicators independently; verification is not a universal ranking advantage.
- Do not expose private Creator diagnostics, experiments, goals, raw screenshots, rates or contact information without specific authorization.
- Respect Creator visibility, blocking, explicit exclusions and revocation.
- Brands may browse permitted public profiles before verification; commercial outreach is gated by M14.

## Proposed screen inventory (not original approved screen IDs)
Creator search and filters; discovery results; authorized profile detail; saved candidates; relevance explanation; audience insight view; eligibility and sharing states.

## Proposed acceptance checks (not original approved AC IDs)
- Private or unpublished Creator fields cannot be retrieved through search or direct URLs.
- Relevance explanations distinguish missing data from failed eligibility.
- UGC does not inherit the influencer follower threshold.
- Revoked grants and unpublished profiles disappear from applicable discovery.

## Dependencies
M05, M06, M09, M10, M14, M18, M29. Reuse existing M01–M14 authentication, RLS, data provenance and workspace contracts.

## Outstanding reconciliation
Recover the exact historical decision list before assigning M16-F identifiers or declaring full module acceptance. Screen routes, schema, detailed transitions, retention and any unrecovered business policies require source confirmation. Do not infer approval of missing requirements.
