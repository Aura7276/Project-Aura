# M02 registration and authentication

Status is **In progress**. The feature branch is `feature/m02-authentication`. Application entry points are /register, /login, /forgot-password, /security and /workspaces. Admin access is checked independently at /admin/access. Provider credentials are never used to authorize a tenant. Each database operation validates the provider identity, active session and relevant membership. An owner must provision Platform Admin records separately. The application exposes no public Admin registration.

## Enable local or staging verification

1. For a disposable local project install Docker and the Supabase CLI, start Docker and run `supabase start` from the repository. Run `supabase migration up --local`. For an isolated staging project, review and back up the database, link with `supabase link --project-ref <staging-ref>`, inspect `supabase db push --dry-run`, then apply the reviewed migration.
2. Copy .env.example to .env.local. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to the project URL and matching publishable key. Set AURA_SITE_URL to the exact origin (HTTPS in staging). Restart Next. Run `pnpm supabase:check`. The app uses no service-role key.
3. In Supabase Auth URL Configuration set Site URL to AURA_SITE_URL and allow the exact /auth/callback and /reset-password URLs. Enable email confirmation, a minimum password length of 12, TOTP enrollment and verification, and provider rate limits. Configure SMTP. Use supabase/templates/confirmation.html and recovery.html for the corresponding email templates. Tokens are read from the fragment and submitted via POST.
4. Enable Google under Auth providers. Store the Google OAuth web client ID and secret in the provider configuration. Register the callback URL displayed by Supabase with Google. For staging configure the email security notifications for password and factor changes and check delivery to a controlled inbox. Enable AURA_SMS_ENABLED only after configuring and verifying a real SMS provider.
5. Run frozen install, format, lint, typecheck, test, build, test:e2e and audit with pnpm. Test email verification and expiry, recovery and logout, Google cancellation, MFA enrollment and challenge, unauthorized access, revocation and membership isolation using two independent authenticated test users in the disposable project. Review security activity and email delivery. Record observed outcomes before acceptance.

## Integration boundaries

M03 and M14 own full onboarding. M10 owns campaign records, M23 Agency operations, M25 outbound notification orchestration, M26 team administration and M27 referral rewards. M02 stores authoritative attribution and accepts pre-issued invitations. Commercial actions require their own server-side checks at implementation time. Initial onboarding changes record entry into the profile step only. Provider session lists and security activity reflect available provider records. Delivery, provider-specific session refresh, database migration compatibility and tenant isolation require live verification.

No project credentials, Docker runtime or Supabase CLI were available for live acceptance in this workspace. Production deployment and owner acceptance remain outstanding.

## Verification evidence

The initial regression run passed 17 unit tests and 49 browser tests with zero skips. The browser suite includes public registration and anonymous workspace redirects. Live authentication checks are separately gated by infrastructure.

For the two-identity isolation regression, create two confirmed, independent disposable email/password users without MFA or shared memberships. Set AURA_DISPOSABLE_AUTH_TEST=true, AURA_TEST_A_EMAIL, AURA_TEST_A_PASSWORD, AURA_TEST_B_EMAIL and AURA_TEST_B_PASSWORD in the test shell. Run `node --env-file-if-exists=.env.local scripts/check-m02-isolation.mjs`. The script creates test profile/workspace records, checks membership-filtered listing and denied cross-tenant selection, then signs out. Use a disposable database.
