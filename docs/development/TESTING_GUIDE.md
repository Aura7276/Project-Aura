# Testing the whole project (M01 to M04)

There are two ways to test the signed-in parts (M02 to M04). The public pages (M01) and the development previews need neither.

| Option                             | What it is                                                                                                                                                                             | You need                                                     |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **A. Local test stack** (quickest) | Real pages and real database migrations, with a small stand-in for Supabase Auth. **Not Supabase.** There is no sign-up, password, email or MFA. You sign in through a one-click link. | PostgreSQL 15 or newer with `psql` on PATH, Node 24, pnpm 11 |
| **B. Real Supabase**               | The full real flow, including registration, email verification and logout.                                                                                                             | A Supabase project (free tier is fine), Node 24, pnpm 11     |

## Option A: local test stack

```bash
pnpm install --frozen-lockfile
```

Make sure PostgreSQL is running and your user can create databases. If needed set `PGHOST`, `PGPORT` and `PGUSER` first. Then:

```bash
pnpm stack
```

It creates a database called `aura_stack`, applies the M02, M03 and M04 migrations, starts the stand-in on port 54331 and the app on port 3103, then prints links. Open the first one:

`http://127.0.0.1:54331/__test/login?email=demo@example.test&to=/onboarding/creator`

Use any other email to get a different test user. Each is created on first use.

What to try, in order:

1. **M03** `/onboarding/creator`: complete the three required steps with **no social account**, skip the optional ones, review, activate. Try Save and exit, then come back.
2. **M04** `/creator/dashboard` (after activating): mark actions done, skip or defer them, capture an idea from the **Create** button, record a progress number on `/creator/progress` (add a target to a goal in onboarding first), search for your idea, open Settings and hide widgets, take and replay the walkthrough, resize to a phone width to see the bottom bar and the menu drawer.
3. **Two users:** open a second browser profile, sign in as another email, and confirm you cannot see the first user's ideas in search.
4. **Log out** from the account menu and confirm Creator Studio is closed.

Automated version of the same flows: `pnpm test:stack` (11 tests).

## Option B: real Supabase

1. In the Supabase SQL Editor, on a **disposable** project, run in this order: `supabase/migrations/20261125000100_m02_identity.sql`, then `20261126000100_m03_creator_onboarding.sql`, then `20261127000100_m04_creator_dashboard.sql`. (The earlier M02 syntax error is fixed, so no patching is needed.)
2. `cp .env.example .env.local` and set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `AURA_SITE_URL=http://127.0.0.1:3101`.
3. In Authentication, URL Configuration: Site URL `http://127.0.0.1:3101`, redirect URLs `.../auth/callback` and `.../reset-password`. Keep email confirmation on and the minimum password at 12. Google sign-in, SMS and Brand MFA need more setup: see `docs/development/M02_AUTHENTICATION.md`.
4. `pnpm dev --port 3101`, then use `/register` and follow the flow above.

## Without either

Previews need no setup and save nothing: `/dev/onboarding-preview/identity` and `/dev/studio-preview/dashboard?situation=aspiring` (also `below100`, `qualifying`, `ugc`).

## Automated checks

```bash
pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e && pnpm test:stack
```

Database tests need a disposable PostgreSQL: set `AURA_TEST_DB=1` plus `PGHOST`, `PGPORT`, `PGUSER`.

## Known limits

M05 to M14 are not built (the app shows "Planned"). Screenshot upload, the AI assistant, email digest, campaigns, content calendar, portfolio and commercial amounts are intentionally unavailable. Registration, password sign-in, email verification, Google sign-in, MFA and device history (M02) are **not** covered by Option A and have not been run against any live service.
