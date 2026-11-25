# Acceptance criteria — consolidated proposed verification checklist

## M01 — Public website and navigation
- M01-AC01: Anonymous visitors see only approved public fields.
- M01-AC02: Unpublished or suspended resources cannot be fetched by direct URL.
- M01-AC03: Campaign CTA carries campaign context through authentication.
- M01-AC04: Referral attribution persists and duplicate/self-referral abuse is controlled.
- M01-AC05: Real navigation and accessible responsive empty states work.

## M02 — Registration and authentication
- M02-AC01: Real email/password and Google auth flows work when configured.
- M02-AC02: Expired/invalid tokens rejected; recovery and logout-all tested.
- M02-AC03: MFA gates privileged actions and cannot be bypassed via API.
- M02-AC04: Cross-workspace and role escalation attempts denied.
- M02-AC05: Onboarding resume and campaign/referral deep links work.

## M03 — Creator onboarding
- M03-AC01: Aspiring creator completes onboarding without social account.
- M03-AC02: 100-follower rule enforced independently of workspace activation.
- M03-AC03: Optional questions can be skipped and resumed.
- M03-AC04: Goals and excluded industries persist and inform authorized recommendations.
- M03-AC05: No private onboarding data is publicly exposed.

## M04 — Creator dashboard
- M04-AC01: No-account creator sees actionable dashboard without fake metrics.
- M04-AC02: Navigation works on desktop and mobile; persistent assistant respects workspace.
- M04-AC03: Daily actions and weekly review reflect authorized evidence.
- M04-AC04: Global search cannot retrieve other tenants’ records.
- M04-AC05: Widget visibility persists; walkthrough skippable; campaign eligibility explained.

## M05 — Social media account management
- M05-AC01: Limit and primary uniqueness enforced under concurrent writes.
- M05-AC02: Duplicate ownership claims go to review without taking over account.
- M05-AC03: Screenshot suggestions do not become observations before confirmation.
- M05-AC04: Private account and removal controls apply to discovery.
- M05-AC05: Disconnect stops jobs; stale data labelled; cross-tenant claims protected.

## M06 — Creator analytics and insights
- M06-AC01: Manual observations display source/date and historical comparisons.
- M06-AC02: Incompatible metrics block misleading comparison.
- M06-AC03: Insufficient evidence returns helpful guidance rather than invention.
- M06-AC04: Experiment baseline and result preserved.
- M06-AC05: Sharing/export checks enforce purpose and current permission.
- M06-AC06: No composite score or unsupported fraud claim.

## M07 — AI Growth Assistant
- M07-AC01: AI works with no social connection and labels uncertainty.
- M07-AC02: Unauthorized cross-workspace context cannot be retrieved.
- M07-AC03: Draft approval required before record changes; replay is idempotent.
- M07-AC04: Memory edit/disable/delete request supported; scheduled tasks opt out.
- M07-AC05: Provider outage preserves drafts and manual tools.
- M07-AC06: Usage limits enforce server-side; no fabricated credentials/results.

## M08 — Content ideation and planning
- M08-AC01: Drafts autosave and restore versions.
- M08-AC02: All four calendar views and recurring edits work.
- M08-AC03: Private assets and unrelated drafts denied to Brand.
- M08-AC04: Repurposing preserves original.
- M08-AC05: Publication must record actual evidence, not scheduled status.
- M08-AC06: Campaign review cannot be bypassed via board transitions.
- M08-AC07: AI outage leaves manual tools available.

## M09 — Creator profile and media kit
- M09-AC01: Profiles private until publication; direct URL cannot bypass restrictions.
- M09-AC02: Item-level permissions respected in kits and exports.
- M09-AC03: Expired/revoked links deny access; QR resolves to correct grant.
- M09-AC04: Sample work labelled; specific verification claims only.
- M09-AC05: Brand outreach requires verification; analytics protect visitor identity.
- M09-AC06: Unpublishing removes authorized discovery/public access.

## M10 — Campaign marketplace
- M10-AC01: Visibility and eligibility enforced at API and DB boundaries.
- M10-AC02: UGC can qualify without influencer follower minimum.
- M10-AC03: Compensation types and actual counts accurately labelled.
- M10-AC04: Material version changes notify affected users.
- M10-AC05: Unverified Brand cannot publish any visibility type.
- M10-AC06: AI cannot apply; blocking/reporting and empty states work.

## M11 — Applications and invitations
- M11-AC01: Quick apply checks all required fields and permission.
- M11-AC02: Concurrent duplicate applications rejected.
- M11-AC03: Drafts persist; submitted changes preserve prior version.
- M11-AC04: Expiry, withdrawal and permitted reapplication tested.
- M11-AC05: Both parties must confirm exact current proposal.
- M11-AC06: Agency delegation and private data access denied outside scope.
- M11-AC07: Capacity and duplicate commitment prevention under concurrency.

## M12 — Collaboration and deliverables
- M12-AC01: Concurrent acceptances create one collaboration and obligation set.
- M12-AC02: Amendment cannot silently alter accepted agreement.
- M12-AC03: Brand cannot access unrelated creator drafts or other creators’ contracts.
- M12-AC04: Review version/stage and revision scope enforced.
- M12-AC05: Dependency delays and contractual rescheduling recorded.
- M12-AC06: UGC completion does not require social posting by default.
- M12-AC07: Dispute evidence protected; unaffected obligations continue.
- M12-AC08: Operational completion does not imply cash received; AI cannot accept/approve.

## M13 — Earnings and commercial management
- M13-AC01: Partial allocations and reversals reconcile accurately under concurrency.
- M13-AC02: Duplicate payment reports do not double count receipts.
- M13-AC03: Self-reported, mutually confirmed and evidence-reviewed distinct.
- M13-AC04: Invoice generation does not duplicate liability; issued version protected.
- M13-AC05: Barter excluded from cash; forecasts not guaranteed.
- M13-AC06: Cross-currency totals require rate/source/date.
- M13-AC07: Private expenses/financial data inaccessible to unrelated Brand.
- M13-AC08: Exports enforce permissions; AI cannot transact or send unapproved follow-ups.

## M14 — Brand onboarding
- M14-AC01: Zero-social Brand can use private growth/planning.
- M14-AC02: Multiple workspaces cannot access each other’s information.
- M14-AC03: Unverified Brand blocked from all campaign publishing/invites/enquiries.
- M14-AC04: Verification for one workspace does not verify another.
- M14-AC05: Privileged MFA enforced; Agency label grants no access.
- M14-AC06: AI extracted claims/personas require confirmation and provenance.
- M14-AC07: Budget optional at onboarding, no spend commitment.
- M14-AC08: Account limit 10 and private-by-default publication enforced.

## Release gates
- Every approved functional requirement mapped to an actual test or explicitly deferred with owner and reason.
- Real hosted staging auth, database and storage E2E; negative tenant and permission tests.
- No skipped critical checks counted as pass; report executed, passed, failed, skipped and evidence.
- Responsive UI, accessible keyboard and focus, clear empty/error/stale/restricted states.
- Security review, migration rollback/forward-fix plan, backup restore, real email test, human UAT.
- Legal/tax/verification policy sign-off before relevant commercial release.
