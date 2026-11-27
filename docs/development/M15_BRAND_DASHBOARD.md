# M15 Brand dashboard

Status — In progress. The owner explicitly authorized building the recovered M15 scope on 27 November 2026. The module source remains a partial reconstruction of 45 historically reported requirements. This implementation does not assign unrecovered M15-F IDs or claim full-module acceptance.

## Entry points

- Development preview at http://127.0.0.1:3101/dev/brand-dashboard.
- Brand workspace picker at /brand.
- Private dashboard at /brand/workspaces/[workspace].
- Existing workspace detail pages link Brands to their dashboard.
- Run the existing pnpm dev --port 3101 command if a development server is needed.

The preview has working-plan, new-Brand and read-only-member scenarios. Its names and priorities are fictional. Observations and commercial metrics are empty until explicitly entered. Changes stay in page memory. The preview is restricted to development mode and was not opened or visually validated during this build-only task.

## Implemented source

The dashboard contains Home, Priorities, Signals, Collaborations and Workspace sections. The design uses the existing AURA typography, a compact dark navigation rail, a lavender planning panel, ruled priority lists and a responsive mobile navigation row. Decorative imagery is replaced with neutral initials and Lucide icons.

Managers can set an objective, audience context, resources and a 7-, 30- or 90-day planning horizon. Priorities have a workstream, date and working notes; they can be edited, completed and reopened. Search, workstream filtering and completed-item visibility are implemented.

Signals capture manually entered counts with metric, account/channel, date, source and context. The interface shows the latest observation for the selected metric and channel and retains the dated source table. It does not combine different accounts or invent automatic analysis.

The collaboration view reads only existing M12 records for the current Brand workspace that the current participant is permitted to access. It links to the shared collaboration interface. Public Creator browsing remains the existing M01 entry. Advanced discovery, campaign publishing, AI, owned-content production and budgets remain dependent on their modules.

## Integration boundaries

M14 has requirements but no onboarding implementation in this checkout. Dashboard focus is therefore explicit private manual context. It is not represented as imported Brand intelligence or completed onboarding. A future M14 adapter must reconcile genuine onboarding data with existing dashboard edits.

Brand dashboard URLs include the workspace ID under /brand/workspaces to preserve the proposed public /brand/[slug] route for later implementation. Workspace selection uses existing M02 access.

The migration depends on M02 identity and M12 collaboration infrastructure. Hosted application remains pending. Private planning is available for unverified Brand workspaces. There are no campaign-publication, invitation or preliminary-outreach mutations in this module. Verification is read from authoritative identity workspace state.

## Authorization and persistence

Migration 20261208000100_m15_brand_dashboard.sql adds private plan and event tables with default-deny RLS and no direct client table access. Existing verified identity and privileged MFA apply.

Active members can read their Brand workspace. Until the granular M26 role matrix is available, open-workspace owners and admins can edit the shared plan and record observations. Other members are read-only. Restricted workspaces remain read-only and suspended workspaces are denied.

Every RPC resolves the requested workspace independently. Writes serialize per workspace and require the expected revision. Repeated request IDs with the same actor and command are idempotent; changed content or actor is rejected. Server actions validate fields with Zod. Events retain actor, command and timestamp privately.

## Decisions and remaining scope

- Latest owner authorization permits this recovered-scope implementation despite historical baseline text describing M15 as pending.
- Original 45-item numbering, complete historical policies, retention and final acceptance scope remain unrecovered.
- Manual planning context supports zero-social and zero-campaign Brands.
- Audience/resources are optional; no maturity score or required budget is invented.
- Owner/admin edit access is a conservative interim implementation pending M26.
- No M14, M16–M22 or future business workflows were built under this authorization.
- M14 intelligence integration, social providers, campaign summaries, commercial budgets, AI assistance and notifications remain pending.
- No tests, lint, type checking, production build, browser validation or hosted migration were run, continuing the owner's build-only instruction.

The working branch is feature/m15-brand-dashboard. Existing untracked module reconstruction files were preserved. No commit or push was requested.
