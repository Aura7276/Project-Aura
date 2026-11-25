# Testing the whole project (M01 to M04)

You need a Supabase project for everything behind sign-in (M02, M03, M04). The public pages (M01) and the development previews work without one.

## 1. Requirements

Node 24, pnpm 11 (`corepack enable`), and a Supabase project (the free tier is enough) or the local Supabase CLI with Docker.

## 2. Apply the database migrations, in this order

Open the Supabase dashboard, then SQL Editor, and run each file's contents on a **disposable** project.

1. `supabase/migrations/20261125000100_m02_identity.sql`. **It has a known defect**: one function ends with `end $;` and should end with `end $$;`. Fix that single line in the editor before running, or create a patched copy:

```bash
sed 's/end \$;$/end $$;/' supabase/migrations/20261125000100_m02_identity.sql > /tmp/m02_fixed.sql
```

2. `supabase/migrations/20261126000100_m03_creator_onboarding.sql`
3. `supabase/migrations/20261127000100_m04_creator_dashboard.sql`

## 3. Configure the app

```bash
cp .env.example .env.local
```

Set these three values (project URL and the publishable key from Settings, API):

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
AURA_SITE_URL=http://127.0.0.1:3101
```

In Supabase, Authentication, URL Configuration: Site URL `http://127.0.0.1:3101`; allow redirect URLs `http://127.0.0.1:3101/auth/callback` and `http://127.0.0.1:3101/reset-password`. Keep email confirmation on and the minimum password length at 12. Google sign-in, SMS and Brand/Agency MFA need extra provider setup (see `docs/development/M02_AUTHENTICATION.md`).

## 4. Run

```bash
pnpm install --frozen-lockfile
pnpm dev --port 3101
```

## 5. What to click

| Module          | Where                                                                      | What to check                                                                                                                         |
| --------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| M01 public site | `/`, `/creators`, `/brands`, `/features`, `/pricing`, `/faq`, `/resources` | Pages, navigation, mobile menu                                                                                                        |
| M02             | `/register`, then confirm the email, then `/identity`, `/workspaces`       | Sign-up, verification, create a **Personal Creator** workspace, log out and in, `/security`                                           |
| M03             | `/workspaces/<id>` then Begin onboarding, then `/onboarding/creator`       | Three required steps, no social account needed, skip optional steps, Save and exit, resume, review, activate, completion screen       |
| M04             | `/creator/dashboard` (after activation)                                    | Dashboard, daily actions, record progress (needs a goal with a number), search, drawer on a phone-sized window, settings, walkthrough |

Without Supabase you can still open the previews: `/dev/onboarding-preview/identity` and `/dev/studio-preview/dashboard?situation=aspiring` (also `below100`, `qualifying`, `ugc`). Previews save nothing.

## 6. Automated checks

```bash
pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e
```

Database tests need a disposable PostgreSQL: set `AURA_TEST_DB=1` and `PGHOST`, `PGPORT`, `PGUSER`.

## 7. Known limits

M05 to M14 are not built (the app shows "Planned" for them). Screenshot upload, the AI assistant, email digest, campaigns, content calendar, portfolio and commercial amounts are intentionally unavailable. Nothing here has been run against a live Supabase project yet, so please report anything that breaks.
