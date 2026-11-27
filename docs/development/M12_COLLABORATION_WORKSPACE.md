# M12 collaboration workspace

Status — In progress. Owner authorized implementation on 26 November 2026 and explicitly requested no testing. No tests, type checking, lint, build, browser inspection, migration execution or hosted connectivity validation were performed for this module.

## Review locations

- Development preview at http://127.0.0.1:3101/dev/collaborations. This route is restricted to development mode.
- Creator entry at /creator/collaborations.
- Shared Creator and Brand entry at /collaborations and /collaborations/[id].
- Development preview records are fictional and remain in page memory. Switch between Creator and Brand to explore the review loop. The agreement scenario resets the preview for acceptance.
- Use the existing development server or run pnpm dev --port 3101. The preview URL has not been opened or verified during this build-only task.

## Delivered source

The shared workspace contains overview, deliverables, agreements, conversation, changes, rights, shared links, performance and activity. Responsive layouts, labelled forms, keyboard focus styles, reduced motion and the existing accessible dialog primitive are included.

The implementation contains version-specific acceptance, immutable agreement presentation and text export, staged submissions, explicit Brand review, feedback scope labels, original submission history, manual fulfilment evidence, dependency updates, rescheduling proposals, cancellation requests, concern evidence, bilateral resolution and bilateral operational completion.

Content Studio integration loads only the Creator's own saved text through existing ownership authorization. Sharing requires selecting a version and sections, previewing the selected text, and explicitly submitting. The shared record stores a snapshot. Other versions and fields remain private.

## Architecture

- src/features/collaborations contains types, validation, interfaces, server actions and an isolated preview transition function.
- src/server/collaborations/service.ts obtains real identity and reads authorized RPC results.
- supabase/migrations/20261205000100_m12_collaboration_workspace.sql adds private workspace, participant and event tables.
- All direct client table access is revoked and RLS defaults to denial.
- Existing verified identity, active membership, workspace status and MFA requirements apply at every RPC.
- Workspace owners/admins can manage agreements. Other members need an explicit per-collaboration participant grant. Reviewer permission is checked separately.
- Membership in both contracting sides is rejected to prevent one account accepting both parties' obligations.
- Commands serialize on the collaboration row and require the current revision. Request IDs make exact retries idempotent. A retry with changed content or identity is rejected.
- Authenticated callers cannot create arbitrary collaborations. The internal provisioning function is reserved for a confirmed M11 proposal integration.
- No AI action changes approval, agreement or compensation state.
- Production completion records both parties' confirmation, fulfilment and resolved concerns. It does not modify settlement.
- External evidence is linked, never fetched by the application. Access to third-party URLs remains governed by that provider's sharing controls.

## Dependencies and remaining scope

This branch has M02–M08 source and no M11 confirmed-proposal implementation. M12 provisioning requires M11 to supply actual contracting workspaces, category-specific obligations and a validated agreement. No production collaborations were fabricated.

The hosted migration remains unapplied. The local implementation is untested and requires an explicitly authorized validation pass before release.

Owner decisions are required for legal templates, acceptance evidence sufficiency, amendment enforceability, delegated Agency authority, cancellation consequences, dispute escalation authority, upload/file limits, retention and exact lifecycle transitions. The current implementation records these proposals without claiming legal resolution. Amendments and renewals can be proposed and declined, but their acceptance remains blocked pending an approved template integration. Original agreements are retained.

Structured per-channel rights, automated expiry reminders, category-specific obligation builders, direct uploads and malware scanning, reviewer assignment UI, scheduled reminders, financial obligation reconciliation, moderated feedback, portfolio permissions, media annotations and AI assistance remain pending. Performance currently captures manual metric, unit/value, period and source links. Required reporting is confirmed by the parties at completion; automated enforcement of category-specific reporting requirements awaits M11 terms.

## Decisions taken for this implementation

- Reused the shared identity system and existing M08 version storage.
- Added a self-contained shared workspace accessible to either contracting party.
- Kept legal template approval as a provisioning prerequisite.
- Used an immutable text export as the equivalent downloadable agreement artifact.
- Submitted external links and selected text snapshots. File upload quotas remain undecided.
- Preserved existing work on feature/m12-collaboration-workspace based on feature/m08-content-studio.
- Retained the visual placeholder strategy. No images were generated or acquired.
- Deferred testing and validation per explicit owner instruction. Implementation statuses do not imply successful execution.

See REQUIREMENTS_TRACEABILITY.md for each M12-F01 through M12-F48.
