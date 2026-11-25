# Historical reference — superseded where conflicting

Do not execute as current instructions. V0.14 approved module documents take precedence. This is retained for traceability, not implementation evidence.

# Screen inventory and routes
Public: `/`, `/creators`, `/brands`, `/agencies`, `/how-it-works`, `/trust`, `/privacy`, `/terms`, `/login`, `/signup`, `/verify-email`, `/forgot-password`, `/reset-password`.
Shared authenticated: `/app`, `/app/workspaces`, `/app/workspaces/new`, `/app/invitations`, `/app/notifications`, `/app/settings/profile`, `/app/settings/security`.
Creator: `/creator/onboarding`, `/creator/dashboard`, `/creator/profile/edit`, `/creator/profile/preview`, `/creator/portfolio`, `/creator/growth-lab`, `/creator/growth-lab/new`, `/creator/opportunities`, `/creator/opportunities/[id]`, `/creator/applications`, `/creator/collaborations`, `/creator/collaborations/[id]`, `/creator/settings/privacy`.
Brand: `/brand/onboarding`, `/brand/dashboard`, `/brand/creators`, `/brand/creators/[id]`, `/brand/shortlists`, `/brand/campaigns`, `/brand/campaigns/new`, `/brand/campaigns/[id]`, `/brand/campaigns/[id]/applications`, `/brand/collaborations`, `/brand/collaborations/[id]`, `/brand/settings/team`, `/brand/settings/verification`.
Agency: `/agency/onboarding`, `/agency/dashboard`, `/agency/clients`, `/agency/clients/[id]`, `/agency/campaigns`, `/agency/settings/team`.
Admin: `/admin`, `/admin/users`, `/admin/workspaces`, `/admin/verifications`, `/admin/verifications/[id]`, `/admin/reports`, `/admin/audit`.
Public creator profile: `/c/[slug]`.
Each route: server auth guard where applicable, workspace scope, empty/error/loading states, accessible interactions and no inert CTAs. Route names may be adjusted for Next.js layout groups but URL contract must be documented.
