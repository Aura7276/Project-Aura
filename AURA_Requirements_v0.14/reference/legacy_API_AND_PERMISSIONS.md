# Historical reference — superseded where conflicting

Do not execute as current instructions. V0.14 approved module documents take precedence. This is retained for traceability, not implementation evidence.

# API and permissions contract
## Roles
Platform ADMIN (separately provisioned). Workspace OWNER, ADMIN, MEMBER; agency delegation with explicit client-granted campaign scope. Never treat workspace ADMIN as platform ADMIN.

## Permission matrix (minimum)
Action | Creator owner/member | Brand owner/admin | Agency delegate | Platform admin
- edit creator profile | own workspace with edit permission | no | no | moderation only
- publish creator profile | creator owner/admin | no | no | moderation suspend
- create campaign | no | yes | only delegated create permission | moderation only
- apply to campaign | authorized creator | no | no | no
- shortlist/invite | no | authorized brand | delegated permission | no
- approve deliverable | no | authorized brand | delegated approval permission | review only
- verify business | no | no | no | yes
- view audit | own workspace subset | own workspace subset | delegated subset | all relevant

## Endpoint families (actual handlers may be server actions)
`/api/me`, `/api/workspaces`, `/api/workspaces/:id/members`, `/api/invitations`, `/api/creators`, `/api/creators/:id`, `/api/creator-profile/publish`, `/api/portfolio`, `/api/campaigns`, `/api/campaigns/:id`, `/api/campaigns/:id/applications`, `/api/applications/:id`, `/api/shortlists`, `/api/invitations/campaign`, `/api/collaborations`, `/api/collaborations/:id/deliverables`, `/api/notifications`, `/api/admin/verifications`, `/api/admin/reports`.
All endpoints: session required except explicit public reads; scope, permission, validation, pagination, rate limit, audit where necessary. Never return internal notes or private fields in public profile endpoint. Idempotency on invitation/acceptance/transition operations.
