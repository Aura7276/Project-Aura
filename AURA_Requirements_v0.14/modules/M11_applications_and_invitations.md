# M11 — Applications and invitations

Status: business requirements approved; implementation details proposed.

## Functional requirements

- **M11-F01** Structured application with pitch, relevant account, optional portfolio and screening.
- **M11-F02** Quick apply where Brand permits; explicit confirmation.
- **M11-F03** Autosave/resume/delete unsubmitted drafts.
- **M11-F04** One active application per Creator per campaign.
- **M11-F05** Mandatory/optional structured screening questions subject to policy.
- **M11-F06** Explicit portfolio/kit selection and preview.
- **M11-F07** AI editable pitch, ideas, screening and portfolio suggestions.
- **M11-F08** Optional AI readiness review.
- **M11-F09** Every submission/reapplication requires explicit Creator confirmation.
- **M11-F10** Submitted edits before review/selection lock; version and material-change notification.
- **M11-F11** Withdrawal before binding agreement acceptance with confirmation and notification.
- **M11-F12** Reapply only if open and permitted.
- **M11-F13** Detailed statuses, timestamps, pending actions and permitted feedback.
- **M11-F14** Optional constructive rejection feedback.
- **M11-F15** Structured clarifications with deadlines/history.
- **M11-F16** Targeted direct invitations for genuine eligible campaigns.
- **M11-F17** Preliminary enquiry distinguished from formal invitation.
- **M11-F18** Interest, clarification, counterproposal or decline.
- **M11-F19** Configurable invitation expiry and reminders.
- **M11-F20** Optional decline feedback.
- **M11-F21** Agency actions only explicit delegation and identified representation.
- **M11-F22** Alternative structured quotes where negotiable.
- **M11-F23** Versioned negotiation workspace with proposals and messages.
- **M11-F24** Permitted compensation, deliverables, timing, revisions, rights and exclusivity negotiation.
- **M11-F25** AI editable negotiation drafts; approve before send.
- **M11-F26** Both parties confirm same proposal version before agreement preparation.
- **M11-F27** Configurable proposal validity/renewal/expiry.
- **M11-F28** Explicit waitlist, no guaranteed selection.
- **M11-F29** Separate submission and selection capacity.
- **M11-F30** Warn about schedule conflicts without rejecting every overlap.
- **M11-F31** No binding agreement from selection or invitation acceptance alone.
- **M11-F32** Link duplicate journeys to one prospective collaboration.
- **M11-F33** Only explicitly shared application and permitted commercial profile data.
- **M11-F34** Rate limits, duplicate prevention and risk-based abuse controls.
- **M11-F35** Block/report abusive invitations; moderation/status tracking.
- **M11-F36** Restrict exploitative unpaid custom work; reasonable screening and existing samples allowed.
- **M11-F37** Auditable versions, decisions and timestamps under retention policy.
- **M11-F38** Core applications, invitations and negotiations free; advanced AI potentially premium.
- **M11-F39** Notifications for statuses, clarifications, invitations, proposals, deadlines and material changes.
- **M11-F40** Reasonable reminders without automated harassment.

## User journey
Apply/invite/enquire → prospective collaboration → review/clarify → negotiate → both confirm same version → revalidate → M12 agreement.

## Logical data entities
Application/version, screening question/response, attachment, clarification, invitation, enquiry, prospective collaboration, proposal/version/confirmation, capacity reservation, audit event.

## Proposed screen inventory
`/creator/applications`, `/creator/marketplace/[id]/apply`, `/applications/[id]/edit`, `/applications/[id]/review`, `/applications/[id]`, `/applications/[id]/history`, `/creator/invitations`, `/invitations/[id]`, `/creator/enquiries`, `/enquiries/[id]`, `/creator/negotiations/[id]`, `/creator/settings/applications`; clarification, withdrawal, counterproposal, report and agreement panels.

## Business rules and security
Proposed app states draft/submitted/review/clarification/shortlisted/waitlisted/selected/rejected/withdrawn/expired/cancelled/converted. Negotiation state separate. Atomic active application/capacity checks. Proposal edit resets confirmation. M14 verified outreach; no automatic binding agreement.

## Acceptance and negative tests
- M11-AC01: Quick apply checks all required fields and permission.
- M11-AC02: Concurrent duplicate applications rejected.
- M11-AC03: Drafts persist; submitted changes preserve prior version.
- M11-AC04: Expiry, withdrawal and permitted reapplication tested.
- M11-AC05: Both parties must confirm exact current proposal.
- M11-AC06: Agency delegation and private data access denied outside scope.
- M11-AC07: Capacity and duplicate commitment prevention under concurrency.

## Outstanding decisions / dependencies
Review lock triggers, reservation expiry, rate limits, reapplication policy and retention pending M12/M17/M18/M29.
