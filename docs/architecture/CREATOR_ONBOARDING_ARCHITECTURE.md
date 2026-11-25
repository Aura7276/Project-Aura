# Creator onboarding architecture (M03)

Status: Implemented. Verified on local PostgreSQL 16 with an `auth` stub. **Not yet verified against live Supabase.**

## Boundaries and ownership

| Concern                                                              | Owner                       | M03 behaviour                                                                                                                                    |
| -------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Identity, sessions, MFA, workspace, membership, workspace onboarding | M02 (`aura_identity`)       | Reused. M03 calls `aura_identity.eligible()` and reads or updates only `workspace.onboarding` and `next_step` during activation. No second auth. |
| Creator profile, onboarding state, niches, goals, challenges         | M03 (`aura_creator`)        | New. Private schema, default-deny RLS, no table grants.                                                                                          |
| `aura_creator.social_account`                                        | M03 foundation, M05 extends | Self-reported and unverified only. M05 widens `verification` and `provenance` and adds refresh and analytics. No competing table.                |
| Publication of a profile                                             | M09                         | `creator_profile.visibility` is constrained to `private`. M09 owns relaxing it.                                                                  |
| AI conversation                                                      | M07                         | `AiOnboardingProvider` contract only. Reported unavailable. `onboarding_state.ai_assisted` is constrained to false.                              |
| Opportunities and campaign requirements                              | M10 / M11                   | `OpportunitySource` and `CampaignRequirementEvaluator` interfaces. The production source is empty.                                               |
| Email and push reminders, automated refresh                          | M25 / M05                   | In-app reminder only. Nothing is scheduled.                                                                                                      |
| Dashboard                                                            | M04                         | Stable entry `m04DashboardEntry` (`/creator`). M03 serves its own completion screen until then.                                                  |

## Access path

Browser, then a Server Component or Server Action, then `creatorContext()`, then the `aura_creator_*` RPC functions.

1. `eligible()` (M02) validates the provider session, profile, MFA requirement and account state.
2. The workspace id is **resolved server-side** from `aura_workspaces` (the caller's own Creator workspace). No client-supplied workspace id is trusted.
3. Every RPC calls `aura_creator.own(workspace, write)`, which re-checks: confirmed live session, active `owner` membership, `kind = 'creator'`, and `status = 'open'` for writes (not suspended for reads).
4. Tables are never granted to `anon` or `authenticated`. All RPCs are `SECURITY DEFINER` with `search_path = ''`.

RPCs: `aura_creator_begin`, `_state`, `_save_section`, `_skip_step`, `_activate`, `_set_action`.

## Persistence and concurrency

- Database state is authoritative. The browser keeps nothing in `localStorage`.
- `onboarding_state.revision` gives optimistic concurrency. Each save carries the revision it was loaded with. The function takes a row lock (`for update`), and a mismatch raises `40001` (conflict). Verified with two simultaneous database sessions.
- A section save is one transaction with replace-set semantics for lists. A failing save rolls back fully (verified).
- `steps` is a JSON map. A missing key means **unanswered**. `skipped` and `completed` are explicit. The two are distinct.
- Activation is idempotent. A second call returns the stored state, with one profile, one plan and an unchanged `activated_at`.

## Mandatory minimum (proposed, owner to confirm)

1. About you: Creator name, country, language and self-identified stage.
2. Niche: a primary niche **or** "still exploring".
3. Goals: at least one goal category. Numeric targets are optional.

Everything else is optional and skippable: social accounts, challenges, collaboration preferences, industries and exclusions, rates, and time and tools. Activation requires no social account, no followers, no experience and no budget.

## Eligibility engine (`eligibility.ts`)

Seven independent facets: workspace activation, growth tools, standard influencer, UGC, social ownership, commercial verification, campaign-specific. The standard rule uses the **single best** individual account at or above 100 followers. Counts are never summed. Self-reported counts only ever produce "meets follower guide, unverified". UGC always reads "needs assessment" because capability criteria are not approved. Unknown follower counts stay unknown.

## Recommendations

`generateInitialPlan` is deterministic and rule-based. It is labelled in the UI and in the database (`rule_based_initial_guidance`) and never claims AI. `recommend()` removes excluded industries before any ranking. With no published opportunities it returns an honest empty state plus preparation actions.

## Privacy

Goals, challenges, targets, resources, rates and observations live only in `aura_creator`, behind owner-scoped RPCs. There is no public projection in M03. The Creator profile cannot be public (`check (visibility = 'private')`). Nothing here is exposed to Brand or Agency actors, discovery, search indexing or AI retrieval. Audit events (`creator_section_saved:<section>`, `creator_onboarding_activated`) reuse `aura_identity.event` and carry no payload.

## Screenshots

Disabled by `screenshotUploadsEnabled = false`. A validator (allowlist, size, signature, MIME match, safe stored names) exists and is unit-tested. Enabling needs a private bucket with owner-scoped storage policies and a malware-scanning step. See the dependency register.

## Reminders and refresh (F20)

All data is editable at `/onboarding/creator/profile`. `reminderDue()` shows an in-app reminder after 90 days. No jobs exist and no social data is refreshed.
