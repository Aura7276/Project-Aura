# Historical reference — superseded where conflicting

Do not execute as current instructions. V0.14 approved module documents take precedence. This is retained for traceability, not implementation evidence.

# End-to-end user journeys (production)
## Guest -> Creator
Visit public site -> Register email/password -> receive verification email -> verify -> sign in -> create Creator workspace -> enter manually supplied Instagram handle marked unverified -> add profile/niche/languages/location -> portfolio upload -> collaboration preferences -> review -> activate PRIVATE workspace -> explicitly Publish -> public profile appears in search -> find open campaign -> submit application -> track status -> accept invitation -> submit deliverable -> receive revision/approval notification.
Failure cases: invalid verification, duplicate account, expired reset link, denied upload, invalid file, draft resume, unpublish, campaign closed, revoked membership.
## Guest -> Brand
Register -> verify -> Brand workspace -> complete business details -> optionally submit verification documents -> verification remains pending until reviewed -> draft paid influencer or UGC campaign -> validate -> publish subject to eligibility rules -> discover published creators -> shortlist -> invite or review applicants -> select creator -> define collaboration -> review deliverable -> request revisions or approve. Notifications are persisted.
## Guest -> Agency
Register -> verify -> Agency workspace -> complete profile -> invite team -> request/receive client delegation -> access delegated brand campaign -> review/manage according to granted permission -> remove delegation immediately revokes access.
## Admin
Admin identity provisioned via secure server-side process (never open signup) -> MFA where supported -> inspect verification queue -> review evidence -> approve/reject with reason -> moderate reports -> record audit -> ensure creators/brands see real status.
## Cross-cutting
User may switch among own workspaces; each switch reloads authorized data. Invitations have expiration and accept/decline states. All writes are transactional and idempotent where needed. User can request export/deletion, with documented handling of retained legal/audit records.
