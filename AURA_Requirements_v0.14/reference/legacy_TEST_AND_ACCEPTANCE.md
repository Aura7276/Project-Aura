# Historical reference — superseded where conflicting

Do not execute as current instructions. V0.14 approved module documents take precedence. This is retained for traceability, not implementation evidence.

# Acceptance criteria — must pass before launch
## Real auth
- New account signs up; verification email arrives; unverified account cannot access protected flows; verified login works; logout invalidates session; password reset works; duplicate email and expired tokens safely handled.
## Creator
- Create workspace; onboarding progress survives restart; upload real portfolio file; profile private by default; explicit publish makes public profile searchable; unpublish removes it; manually entered Instagram handle clearly labelled unverified.
## Brand
- Create brand; verification submission stays pending until admin decision; create/publish real paid/UGC campaign; discover public creators; shortlist/invite; review application; accept creator; review uploaded deliverable and request revision/approve.
## Agency
- Create agency; add team; obtain explicit brand delegation; manage only delegated campaigns; revoke delegation and verify immediate access denial.
## Admin
- Privileged admin can review and decide verification with audit; ordinary user cannot access admin routes or APIs; moderation state changes reflected publicly.
## Data integrity
- All state persists after refresh and new session; concurrent transitions do not double-apply; invalid status changes rejected; no fake counts or seeded production records.
## Security
- Cross-tenant read/write tests for all entity families; IDOR and upload authorization negative tests; unauthenticated calls blocked; private object URLs expire; session and reset flow tests.
## UX and quality
- Desktop/mobile at 360/768/1440; keyboard and reduced-motion; loading/empty/error; no dead links; typecheck, lint, unit, integration, Playwright E2E, production build pass.
## Production verification
- Staging email delivery and callback URLs tested; production domain TLS; migration rollout; backups and restore test; monitoring; smoke test with two real non-admin test accounts and an admin; remove test accounts/data after validation.
## Report
- Every acceptance item: PASS/FAIL/BLOCKED with evidence (command output, screenshot, provider verification). Never report PASS if blocked by credentials or access.
