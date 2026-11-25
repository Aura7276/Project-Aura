# M03 Creator onboarding: completion report

Branch `feature/m03-creator-onboarding`, based on `feature/m02-authentication` at `471c4d6` (M02 on top of M01 `cbb1aa3`). **Not merged. Not pushed.** `main` is `14aab75`.

## 1. Summary

M03 is implemented and verified at the database and component level. The onboarding flow, eligibility engine, persistence, RLS, plan, checklist and recommendation architecture all exist and pass tests. **It is not accepted.** There was no live Supabase project, so Auth, PostgREST and Storage were never exercised, and the authenticated flow through the real server actions was never run end to end. Owner acceptance is not recorded.

## 2. Baseline and defects found in M02

M02 was missing when work began (only `main` and the M01 branch were published). The owner then published `feature/m02-authentication`. M03 is based on it.

- **M02 defect (fixed on the M04 branch, commit `b1f6d9e`):** `supabase/migrations/20261125000100_m02_identity.sql` ends `aura_attribute_referral` with `end $;` instead of `end $$;`. PostgreSQL rejects the file, so M02 **cannot be applied as committed**. I did not edit M02. Tests apply a patched copy. M02's branch needs a one-character fix.
- M03 touches one M02 file: `src/app/(identity)/workspaces/[id]/page.tsx` gains a link to `/onboarding/creator` (7 lines).
- Toolchain: this environment has Node 22.23.5. The repo pins Node 24. Everything was run on 22.

## 3. Requirements

| ID  | Status      | Note                                                                                                                          |
| --- | ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| F01 | Tested      | Eligibility unit tests plus DB.                                                                                               |
| F02 | Implemented | Three required steps; rest optional. UI verified in preview; server actions not run live.                                     |
| F03 | Tested      | DB: activation with zero accounts.                                                                                            |
| F04 | Tested      | Six platforms; URL allowlist.                                                                                                 |
| F05 | Tested      | Personal, Creator and Business Instagram.                                                                                     |
| F06 | Tested      | Multiple per platform, one primary (DB unique index), limit 10.                                                               |
| F07 | In progress | Manual entry tested. **Screenshots Blocked** (private storage and scanning absent). Validator tested, upload disabled.        |
| F08 | Tested      | One primary, secondary, interests, custom, exploring.                                                                         |
| F09 | In progress | Structured questionnaire implemented. **AI path Blocked on M07.** Contract and availability check only; reported unavailable. |
| F10 | Tested      | Observed, self-reported, unknown baselines; deferrable targets.                                                               |
| F11 | Tested      | Optional, post-activation.                                                                                                    |
| F12 | Tested      | All six stored; availability labelled.                                                                                        |
| F13 | Tested      | Minor units, INR default, unsure, negotiable.                                                                                 |
| F14 | Tested      | Nothing requires experience or rates.                                                                                         |
| F15 | Tested      | Exclusions separate and take precedence (DB trigger and schema).                                                              |
| F16 | Tested      | `visibility` constrained to `private`.                                                                                        |
| F17 | Implemented | Informational only. Enforcement belongs to commercial modules; none exist yet.                                                |
| F18 | Tested      | RLS negative tests.                                                                                                           |
| F19 | Tested      | Deterministic plan persisted; data-driven checklist; honest empty opportunities.                                              |
| F20 | In progress | Editing and in-app reminder implemented. **Automated refresh Blocked on M05 and M25.**                                        |

## 4. Acceptance criteria

See [M03_ACCEPTANCE.md](../acceptance/M03_ACCEPTANCE.md).

## 5. Routes

`/onboarding/creator` (welcome and resume), `/onboarding/creator/{identity,social,niche,goals,challenges,preferences,review}` (flow), `/onboarding/creator/{rates,resources}` (after activation), `/onboarding/creator/complete` (plan, checklist, eligibility, opportunities, M04 entry), `/onboarding/creator/profile` (edit hub, reminders). Development only (404 in production): `/dev/onboarding-preview/{step|summary}`.

## 6. Journey

About you, accounts (or "no account yet"), niche (or exploring), goals, challenges (skippable), preferences (skippable), review, activate, completion screen. Back, Continue, Skip, Save and exit throughout.

## 7. Backend

Server actions `saveStep`, `activate`, `toggleAction`. Service `src/server/creator/service.ts`. Zod schemas validate all input server-side. Per-user rate limiting (per instance only). Errors map to safe categories and never echo database messages.

## 8. Database

One additive migration, `20261126000100_m03_creator_onboarding.sql`: 16 tables in `aura_creator` (three reference taxonomies, profile, state, niche, social account, goal, challenge, resources, collaboration, industry preference, industry exclusion, rate, growth plan, growth action), six RPC functions, default-deny RLS. No M02 definitions altered.

## 9. Supabase connectivity

**None.** No credentials or project were available. `supabase:check` was not run.

## 10. Persistence results

17 SQL scenario groups and 8 Vitest database tests passed on PostgreSQL 16 with an `auth` stub, including save and exit, resume from a new connection, skip, goal and exclusion editing, duplicate activation, atomic rollback on a failed save, and two simultaneous writers (one wins, one gets a conflict).

## 11. Eligibility behaviour

See architecture document. Highlights: single best account at 100, never summed; Brand pages excluded; UGC separate and always "needs assessment"; self-reported equals unverified.

## 12 to 13. Privacy, authorization and RLS evidence

Denied with the right SQLSTATE: anonymous, direct table access, private helper functions, cross-Creator, wrong or null workspace, Brand, Agency, non-owner member, suspended workspace, other Creator's plan action, public visibility. Inspected: RLS on every `aura_creator` table, zero grants to `anon`, `authenticated` and PUBLIC, no policies (default deny), only six functions executable, all `SECURITY DEFINER` functions pin `search_path`.

## 14. Growth plan

Deterministic rules over stage, accounts, niche, goals, challenges and resources. Five to seven actions across seven days. Labelled "rule-based, not AI-generated". No outcome promises (unit tested).

## 15 to 16. Tests and build

Unit 65 passed, browser 79 passed, 0 skipped. Format, lint, strict typecheck, production build, `pnpm audit` clean. Node 22, not 24.

## 17. Screenshots

`docs/development/evidence/m03/` (identity, social, niche, goals, preferences, summary at 390 and 1440 px). They show development preview data, not a real Creator.

## 18. Accessibility

axe (WCAG 2.0/2.1 A and AA) found no violations on all nine preview screens. No horizontal overflow at 320, 360, 390, 430, 768, 1024, 1440 and 1920 px. Keyboard selection of option cards verified. **Not done:** manual screen-reader testing and contrast audit beyond axe. The progress indicator and errors are announced via roles and live regions but untested with assistive technology.

## 19. Outstanding provider dependencies

Live Supabase project and Auth (Google, SMTP). Private storage bucket and malware scanning (screenshots). M07 AI provider. M05 verification and refresh. M10 opportunities. M25 notifications. Edge or WAF rate limiting.

## 20. Unresolved business decisions

1. Confirm the mandatory minimum.
2. Definition of a "relevant individual account". M03 uses a self-declared individual-versus-Brand/company flag.
3. UGC capability criteria.
4. Verification triggers for commercial activity.
5. Reminder cadence (90 days is a placeholder).
6. Retention and deletion of private onboarding data.
7. Currency list (eight shown).
8. Screenshot retention and scanning provider.

## 21. Manual checklist

See M03_ACCEPTANCE.md.

## 22. Git

Branch `feature/m03-creator-onboarding`, local commit only. No push, no merge, no PR.

## 23. M04 readiness

M04 can read `aura_creator_state(workspace)`, the persisted plan, the checklist builder and `m04DashboardEntry`. M03 does not build a dashboard.
