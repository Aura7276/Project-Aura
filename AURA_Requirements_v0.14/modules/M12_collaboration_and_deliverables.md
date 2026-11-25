# M12 — Collaboration and deliverables

Status: business requirements approved; implementation details proposed.

## Functional requirements

- **M12-F01** Dedicated shared workspace: agreements, deliverables, milestones, messages, files, activity.
- **M12-F02** Common infrastructure for six campaign categories, category-specific obligations.
- **M12-F03** Separate agreements/deliverables/compensation per selected Creator.
- **M12-F04** Independent collaboration, deliverable and compensation states.
- **M12-F05** Structured agreement from confirmed proposal using approved templates.
- **M12-F06** Explicit authorized same-version acceptance with verification/evidence.
- **M12-F07** Externally signed agreement attachments and structured obligations.
- **M12-F08** Versioned mutually accepted amendments; original retained.
- **M12-F09** Downloadable versioned PDF or equivalent with acceptance evidence.
- **M12-F10** Future advanced electronic signature integration subject to validation.
- **M12-F11** Independent deliverables, specs, deadlines, review conditions and optional compensation allocation.
- **M12-F12** Optional concept, script, draft, final and publication/handover approval stages.
- **M12-F13** Track Creator and Brand deadlines including samples and reviews.
- **M12-F14** Flag delayed dependencies; mutually approved rescheduling, no unfair penalties.
- **M12-F15** Content Studio linkage without exposing drafts.
- **M12-F16** Configurable reminders and responsible party.
- **M12-F17** Uploads, authorized links and selected Content Studio records.
- **M12-F18** Submission versions, notes, reviews and timestamps.
- **M12-F19** Approve, request revision or documented concern.
- **M12-F20** Feedback linked to agreed requirements where possible.
- **M12-F21** No default automatic approval; deemed acceptance only explicitly agreed and legally validated.
- **M12-F22** Phased image annotations/video timestamp comments.
- **M12-F23** Track contractual revisions, voluntary improvements and extra requests separately.
- **M12-F24** Flag potential out-of-scope revisions; amendment or dispute.
- **M12-F25** Either party can propose structured change with compensation/timeline impact.
- **M12-F26** AI scope comparison without binding determinations.
- **M12-F27** Manual publication URL/date/evidence.
- **M12-F28** UGC authorized handover and acceptance; posting only if agreed.
- **M12-F29** Agreed performance metrics, periods and provenance.
- **M12-F30** Authorized designated downloads subject to rights.
- **M12-F31** Structured ownership, channels, duration, territory, advertising and restrictions register.
- **M12-F32** Separate organic use, paid ads, account authorization and ownership transfer.
- **M12-F33** Track exclusivity scope, competitors, territory and expiry; conflict warnings.
- **M12-F34** Rights expiry reminders and renewal proposals.
- **M12-F35** Explicit separate AI-related content/likeness permissions.
- **M12-F36** Either party cancellation request with reasons and affected obligations.
- **M12-F37** Partial completion, applicable compensation and disputed amounts.
- **M12-F38** Internal dispute evidence, response, mutual resolution and escalation.
- **M12-F39** Track disputed obligations separately without freezing unrelated work.
- **M12-F40** Protect dispute evidence, access and retention.
- **M12-F41** Completion requires applicable approval, fulfilment and reporting.
- **M12-F42** Operational completion independent of financial settlement.
- **M12-F43** Genuine bilateral feedback with moderation/disputes.
- **M12-F44** Optional portfolio addition subject to consent, confidentiality and rights.
- **M12-F45** Granular participant permissions, reviewers and delegated Agency authority.
- **M12-F46** AI brief explanation, planning, draft review, communication and reminders.
- **M12-F47** No autonomous AI approval or commercial amendment acceptance.
- **M12-F48** Core Creator collaboration tools free initially.

## User journey
Confirmed proposal → agreement review/acceptance → activate → produce → submit exact versions → review/revise → fulfil → report → operational completion; settlement independent; feedback/portfolio optional.

## Logical data entities
Collaboration, agreement/version/acceptance, deliverable, stage, milestone/dependency, submission/version, review, revision, amendment, publication/handover, performance report, licence, exclusivity, cancellation, dispute/evidence, feedback, audit, financial obligation.

## Proposed screen inventory
`/creator/collaborations`, `/collaborations/[id]`, `/agreement/draft`, `/agreement`, `/agreement/history`, `/brief`, `/deliverables`, `/deliverables/[did]`, `/milestones`, `/calendar`, `/files`, `/messages`, `/changes`, `/performance`, `/rights`, `/activity`, `/disputes/new`, `/disputes/[did]`, `/completion` (collaboration-relative); acceptance, submission/review, amendment, publication/handover, renewal, cancellation, feedback panels.

## Business rules and security
Same-version immutable accepted agreement; external attachment discrepancies resolved before activation. Review exact stage and version. Do not auto-approve by default. Separate operational, deliverable, financial lifecycle. Disputed flags independent. No payment processing, binding arbitration or guaranteed external licence enforcement.

## Acceptance and negative tests
- M12-AC01: Concurrent acceptances create one collaboration and obligation set.
- M12-AC02: Amendment cannot silently alter accepted agreement.
- M12-AC03: Brand cannot access unrelated creator drafts or other creators’ contracts.
- M12-AC04: Review version/stage and revision scope enforced.
- M12-AC05: Dependency delays and contractual rescheduling recorded.
- M12-AC06: UGC completion does not require social posting by default.
- M12-AC07: Dispute evidence protected; unaffected obligations continue.
- M12-AC08: Operational completion does not imply cash received; AI cannot accept/approve.

## Outstanding decisions / dependencies
Legal agreement templates, enforceability, signature evidence, dispute authority, file limits, retention and exact transitions pending.
