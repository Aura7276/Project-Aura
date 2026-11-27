# M17 — Campaign Creation and Management

Status: **partial reconstruction for owner reconciliation; not a complete approved specification.**

Historical tracker: 60 functional requirements approved/reported. Exact original numbered list not recovered; the entries below are not a replacement for those IDs.

## Scope
Verified Brands create and manage structured commercial opportunities.

## Recovered requirements and established cross-module constraints
- Support paid influencer, UGC, barter, affiliate, ambassador and event campaign categories.
- Rollout: paid influencer, UGC and barter first; events and ambassador next; affiliate after attribution readiness.
- Capture objectives, deliverables, relevant platforms, audience and Creator requirements, deadlines, compensation, usage rights and exclusivity.
- Separate mandatory requirements from preferences and distinguish monetary from non-monetary compensation.
- Disclose meaningful monetary amount/range before application where applicable; label negotiable terms.
- Support public, restricted and invitation-only visibility.
- All formal campaign publication and invitations require approved Brand verification; unverified Brands may prepare private drafts.
- Track actual available positions and material changes; notify affected participants and preserve accepted commercial terms.
- No application fees or unlock deposits; risk-based moderation and flagged review.
- Campaign changes must not silently amend M12 binding agreements.

## Proposed screen inventory (not original approved screen IDs)
Campaign list; draft editor; objective and audience; deliverables; compensation and rights; eligibility; preview and publish; campaign versions; status and amendments.

## Proposed acceptance checks (not original approved AC IDs)
- Unverified Brand cannot publish or invite through any interface.
- Public preview only exposes approved fields; private campaigns cannot be fetched anonymously.
- Material edits are versioned and do not alter accepted agreements.
- Campaign category availability matches rollout readiness.

## Dependencies
M10, M11, M12, M14, M18, M22, M25, M29. Reuse existing M01–M14 authentication, RLS, data provenance and workspace contracts.

## Outstanding reconciliation
Recover the exact historical decision list before assigning M17-F identifiers or declaring full module acceptance. Screen routes, schema, detailed transitions, retention and any unrecovered business policies require source confirmation. Do not infer approval of missing requirements.
