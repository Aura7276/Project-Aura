# Logical data requirements (not executable schema)

## M01 — Public website and navigation
Public profile projection, campaign preview, resource, support request, referral attribution.

## M02 — Registration and authentication
User, workspace, membership, invitation, session/device, MFA state, referral context, security event, verification state.

## M03 — Creator onboarding
Creator profile, onboarding session, niche, goal, preference, exclusion, resource assessment, growth plan.

## M04 — Creator dashboard
Dashboard preference, daily action, milestone, goal observation, weekly review, recommendation, search index projection.

## M05 — Social media account management
Social account, account claim, challenge, verification evidence, observation, content observation, source, visibility, integration credential reference, refresh job.

## M06 — Creator analytics and insights
Metric definition, observation, measurement window, content tag, insight, experiment, baseline, result, cohort aggregate, sharing grant, report.

## M07 — AI Growth Assistant
AI profile, conversation, message, recommendation, approved action, context reference, feedback, usage event, scheduled job, provider configuration.

## M08 — Content ideation and planning
Idea, pillar, content item, draft/version, event, task, asset, series, adaptation, publication, performance association, commercial association, reminder.

## M09 — Creator profile and media kit
Profile projection, portfolio item, case study, service, rate card, package, media kit/version/section/share grant, availability, testimonial, view event.

## M10 — Campaign marketplace
Campaign, campaign version, requirement, compensation, deliverable definition, rights, visibility grant, eligibility result, bookmark, saved search, recommendation, report.

## M11 — Applications and invitations
Application/version, screening question/response, attachment, clarification, invitation, enquiry, prospective collaboration, proposal/version/confirmation, capacity reservation, audit event.

## M12 — Collaboration and deliverables
Collaboration, agreement/version/acceptance, deliverable, stage, milestone/dependency, submission/version, review, revision, amendment, publication/handover, performance report, licence, exclusivity, cancellation, dispute/evidence, feedback, audit, financial obligation.

## M13 — Earnings and commercial management
Obligation, schedule, receipt, confirmation, allocation, adjustment/reversal, evidence, reconciliation case, external income/client, invoice/version, credit note, expense, time, reimbursement, barter benefit, commission, recurring schedule, FX observation, target, report, audit.

## M14 — Brand onboarding
Brand workspace/profile/legal entity/representative, onboarding, objective/goal, maturity, product/claim, segment/persona, guideline/asset, social account, indicative budget, creator preference, competitor, verification case/evidence/decision, intelligence profile, growth plan, Agency relationship, membership.

## Proposed implementation constraints
- UUID PK, tenant workspace FK, created/updated timestamps, actor and source where appropriate; explicit cross-tenant collaboration membership rather than trusting one tenant ID for shared objects.
- Separate public projections and authorized discovery views; no direct public access to base tables.
- Versioned observations, proposals, agreements, submissions, invoices and audit events. Immutable accepted versions; correction/reversal events rather than overwrite.
- Transactional uniqueness for one active application per creator/campaign, one active verified ownership claim per social account, primary account uniqueness, capacity reservations, one activation per agreement, receipt allocations and recurring schedules.
- Monetary values: exact decimal or integer minor units with ISO currency; no floating-point financial arithmetic; rounding rules validated before release.
- Timestamps UTC, retain user/business timezone for deadlines. Store actual observation date separately from entry date.
- Private storage metadata, signed URL expiration, access grant and deletion status; object policies enforce parent authorization.
- Migration design, schema, indexes, retention and RLS matrix to be reviewed against actual repo; no SQL is represented as validated.
