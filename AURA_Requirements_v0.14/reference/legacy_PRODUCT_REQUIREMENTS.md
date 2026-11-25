# Historical reference — superseded where conflicting

Do not execute as current instructions. V0.14 approved module documents take precedence. This is retained for traceability, not implementation evidence.

# Production PRD v1 — no placeholders
## Audience and goals
Creator (100–999 through 20k+ and larger), brand (SMB/D2C first), agency, admin. Creator: profile, portfolio, growth experiments based on self-entered observations, collaboration discovery and management. Brand: discover published creators, campaign briefs, applications, shortlists, invitations, deliverable review. Agency: delegated client management. Admin: moderation, verification and oversight.

## P0 functional modules
1. Public marketing: Home, Creators, Brands, Agencies, How it Works, Trust/Privacy, Terms, Login, Register; accessible responsive and no fake social proof.
2. Auth: signup/login/logout, verification, password recovery, protected routes, session expiration, email uniqueness, account closure workflow.
3. Identity: user profile, workspace creation/switch, memberships, roles OWNER/ADMIN/MEMBER (permissions in matrix), invite accept/revoke, no cross-tenant reads.
4. Creator onboarding: username/URL (self-reported), profile, niche, languages, location, content formats, portfolio media, availability, indicative rates, collaboration interests, review, private activation, explicit publish/unpublish. No Meta gate in this release.
5. Brand onboarding: business identity, category, location, website, contact, goals, verification document submission and status PENDING/APPROVED/REJECTED; approval by authorized admin only.
6. Agency onboarding: identity, service model, team, client relationships; delegated client access required.
7. Creator directory: only published/eligible creators, filter niche/location/language/format/availability; pagination, clear unverified social fields; profile detail, shortlist and invite.
8. Campaigns: brand workspace drafts and publish, paid influencer and UGC types, brief, eligibility, budget range, deliverables, deadlines, application rules; status transitions; applications with status history, shortlists, invitations, selection.
9. Collaboration: agreed scope/compensation notes, deliverable submissions (files/URLs), feedback, revision requests, approvals, status timeline and notifications; no escrow, payments, or automated paid state.
10. Creator Growth Lab: creator-authored goals, hypotheses, planned content experiments, checkpoints and manual observations; explicitly labelled self-reported. Do not generate purported Instagram insights.
11. Agency: add client via authorized invitation/delegation, view/manage only delegated client campaigns; no implicit full access.
12. Admin: verification review, reports, moderation, suspend/restore, audit trails, reason capture, permission controls.
13. Notifications: database-backed in-app notifications for invites, applications, approvals, revisions, verification; read/unread state; no fake unread counts.
14. Settings: profile, privacy, members, invitations, export/delete request, workspace details.

## Later, explicitly out of P0
Meta Instagram OAuth, API insights, AI-generated performance analytics, real-time messaging, gateway payment processing, escrow, billing, affiliate attribution, automated brand matching, advanced multi-client agency analytics, automated identity verification. Never display non-functional CTA for these.

## Business rules
- Only public creator profiles appear in directory; unpublish removes discoverability immediately.
- Users can own multiple workspaces; a brand user cannot read another brand's data.
- Published campaign can receive applications only while OPEN and within window.
- Creator may apply once per campaign; application withdrawal and reapplication rules documented in state machine.
- Brand can invite a creator; creator acceptance is required before collaboration starts.
- Only authorized brand/agency delegates may review or approve deliverables; action is audited.
- Verification status reflects manual admin review, not user submission.
- File upload success requires object persisted, metadata saved, authorization and access controls tested.

## Completion
Real signups, persisted records, working permissions, working file uploads, fully connected role journeys, emails delivered, end-to-end tests green, security review, deploy and smoke tests. Details in TEST_AND_ACCEPTANCE.md.
