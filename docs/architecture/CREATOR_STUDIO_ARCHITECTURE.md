# Creator Studio architecture (M04)

Status: Implemented. Verified on local PostgreSQL 16 with an `auth` stub and in Chromium against a development preview. **Not verified against live Supabase.**

## 1. Integration with M02 and M03

| Concern                                                                                        | Owner                                        | M04 behaviour                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Identity, sessions, workspace, membership, logout, security, workspace switching               | M02 (`aura_identity`)                        | Reused. Layout calls `studioContext()`, which calls M03 `creatorContext()` (M02 `eligible()` plus the caller's own Creator workspace). Account menu links to `/security`, `/workspaces` and the M02 `logout` action. No second auth. |
| Creator profile, goals, plan, checklist, social accounts, preferences, exclusions, eligibility | M03 (`aura_creator`, `creator-onboarding/*`) | Read-only reuse via `aura_creator_state()`. M04 never copies or duplicates them. The only write into M03 is marking the linked **plan action** done or todo when a plan-linked daily action changes.                                 |
| Dashboard preferences, daily actions, goal observations, ideas, milestones, weekly reviews     | M04 (`aura_studio`)                          | New. Private schema, default-deny RLS, no table grants, 14 `SECURITY DEFINER` functions.                                                                                                                                             |

Access chain for every request: M02 session, then owner of a `creator` workspace (M03 `own()`), then **Creator activation complete** (`aura_studio.own()` raises `55000` otherwise), then the operation. If onboarding is incomplete the layout redirects to the M03 continuation (`/onboarding/creator`). The workspace id is resolved server-side and never taken from the client. Membership revocation, suspension and a Brand or Agency workspace all fail at the database.

## 2. Route inventory

`/creator` (redirects), `/creator/dashboard`, `/creator/actions`, `/creator/progress`, `/creator/recommendations`, `/creator/grow`, `/creator/create`, `/creator/studio`, `/creator/search`, `/creator/notifications`, `/creator/settings/dashboard`. Development only (404 in production): `/dev/studio-preview/{dashboard|actions|progress|recommendations|create|grow|studio}?situation={aspiring|below100|qualifying|ugc}`.

## 3. Navigation

`nav.ts` is the single typed source. Five primary areas: Home, Grow, Create, Collaborate, My Studio. `available` items must resolve to a real page (test-enforced). `planned` items have no link and render as "Planned · Mxx" with an explanation, never as dead links. Desktop uses a sticky sidebar with secondary destinations. Mobile (below 64rem) uses a fixed bottom bar with safe-area padding plus a modal drawer (native `<dialog>`: focus trap, Escape, focus return). Content has bottom padding and `scroll-margin` so fixed bars never cover focused controls (tested).

| Area        | Available now                                                                             | Planned                                               |
| ----------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Home        | Dashboard                                                                                 |                                                       |
| Grow        | Daily actions, Progress, Social accounts (M03, self-reported)                             | Analytics M06, Growth Assistant M07                   |
| Create      | Idea capture                                                                              | Content Studio and calendar M08                       |
| Collaborate | Recommendations and eligibility                                                           | Marketplace M10, Applications M11, Collaborations M12 |
| My Studio   | Profile and preferences (M03), Dashboard settings, Security (M02), Switch workspace (M02) | Media kit M09, Earnings M13                           |

## 4. Personalization rules (deterministic, not AI)

`situationOf()` uses real M03 data and the M03 eligibility engine: `no_accounts`, `counts_unknown`, `below_100`, `qualifying` (best single individual account at 100 or more, never summed). Widget order per situation:

- `no_accounts`: actions, plan, content, checklist, goals, weekly, milestones, recommendations, commercial.
- `counts_unknown`: actions, goals, checklist, content, plan, weekly, recommendations, milestones, commercial.
- `below_100`: actions, goals, content, plan, weekly, recommendations, checklist, milestones, commercial.
- `qualifying`: actions, goals, content, recommendations, plan, weekly, commercial, checklist, milestones.
- UGC-focused stage or UGC interest moves recommendations to third place.

Daily actions are first in every situation and the commercial overview never precedes actions, goals or plan (tested). Hidden widgets and the gamification switch only remove widgets. **Personalization never grants permissions or eligibility.** Essential notices (private profile, unverified accounts) are not widgets and cannot be hidden.

## 5. Daily-action generation

`generateDailyActions()` picks three to five distinct rules by priority, with a rotation and fallbacks. Rules fire only from persisted data and link only to routes that exist:

| Rule             | Fires when                                                                   | Priority | Dependency label  |
| ---------------- | ---------------------------------------------------------------------------- | -------- | ----------------- |
| `plan:<id>`      | an M03 plan action is not done (next by position)                            | 100      |                   |
| `weekly_review`  | Monday and at least one closed review exists                                 | 90       |                   |
| `observe:<goal>` | a goal has a measure and no observation in 7 days (85 if never)              | 80 to 85 |                   |
| `idea`           | fewer than 3 ideas, or none in 7 days (88 if the challenge is content ideas) | 70 to 88 |                   |
| `schedule`       | consistency goal or consistency or time challenge                            | 65       | M08 (preparation) |
| `measure`        | goals exist but none has a measure                                           | 60       |                   |
| `read:<slug>`    | always; chosen by challenge and goal from the three real guides              | 55       |                   |
| `profile:<id>`   | first optional checklist item still to do (skipped items are never nagged)   | 50       |                   |
| `ugc_prep`       | UGC interest or stage (75 when UGC-focused, else 48)                         | 48 or 75 | M09 (preparation) |
| `eligibility`    | collaboration interest and standard rule not met                             | 45       |                   |
| fallbacks        | to guarantee three: reflect, a guide, review goals                           | 8 to 10  |                   |

Rules completed in the last three days are rotated out except plan actions. The database **computes today from the stored time zone** (never from the client), serializes with an advisory lock, and returns an existing day unchanged, so re-opening never regenerates. Generation requires 3 to 5 actions, or it rejects and leaves nothing. States are pending, completed, skipped and deferred. `status_at` changes only on a real change, so repeated submits cannot rewrite history. Completing an action marked with a dependency means the Creator _prepared_, and the UI says so.

## 6. Goals, observations and provenance

Goals are M03 rows. Observations (`goal_observation`) are **append-only**, keyed by `(category, metric)` and not by goal id, so editing goals in M03 (which replaces the set) never erases history. They carry `source = 'self_reported'` (M05 and M06 widen to provider-derived and verified) and have an idempotency `request_id`. Display distinguishes: recorded zero (a value), no observation (unknown), no measure, stale (older than 14 days) and self-reported. Progress is `(latest − baseline) / (target − baseline)` **only** when a real baseline and a target exist. With no baseline it shows the latest against the target and no percentage. Insights state the recorded change and explicitly make no causal claim. Charts render only with two or more observations, as inline SVG with a data-table alternative.

## 7. Milestones and streaks (proposed definitions, owner to confirm)

Milestones are first-time events derived from real records and stored at their true time: workspace activated, first action completed, first progress observation recorded, first idea captured. No thresholds are invented. The streak is the number of consecutive local days (stored time zone) with at least one completed action, ending today or yesterday; a lapse shows no penalty. No leaderboards, no scores, no public ranking. Users can switch milestones and streaks off (nothing is then recorded or shown).

## 8. Weekly review

Weeks are Monday to Sunday in the stored time zone. Closed weeks since activation (up to 12) are generated once and stored (`weekly_review`, primary key `(workspace, week_start)`, idempotent, advisory-locked). The current week is computed live. Completions count once, in the week they actually happened. Assignments count by assigned date. A weak week is stored as "insufficient evidence", not filled in. Profile improvements come from real M03 audit events. The narrative layer lists counts only, with no percentages or causal claims. The email digest is a **stored preference only**: `digest_delivery` is always `unavailable`, and the UI says nothing is sent.

## 9. Search authorization

`aura_studio_search()` re-authorizes in the database, reads only the caller's workspace (ideas, actions, plan actions, goal details and observation notes), escapes `% _ \` so wildcards are literal, requires 2 to 60 characters and caps results. Catalogue search (tools, the three public guides) and own-profile labels use only public config or the caller's already-authorized state. Nothing is indexed publicly. There are no recent searches, no suggestions and no stored queries. Results are links to routes that re-authorize on open. Campaigns (M10) and collaborations (M12) are reported as "not searched yet". Counts shown are of authorized results only.

## 10. Other contracts

- **Assistant:** `assistantAvailability()` returns unavailable without a provider. The dialog shows workspace name and page, offers manual tools, has no text input and never invents a reply. `GrowthAssistant` is the M07 contract.
- **Notifications:** `aura_studio_events()` returns only the caller's whitelisted real events. There is no unread state, so no badge or count. Email and push need M25.
- **Commercial:** `CommercialSource` returns `unavailable (M13)`. This is distinct from `none`. No amounts are ever invented. AURA holds no funds.
- **Walkthrough:** nine steps highlighting real elements, optional, skippable at any step, keyboard operable, repeatable (settings or `?tour=1`). Status (`not_seen`, `completed`, `dismissed`) is stored per workspace and user.
- **Preferences:** hidden widgets (validated against a fixed list), gamification, digest opt-in, time zone (validated against `pg_timezone_names`), reset to defaults.

## 11. Integration boundaries

M05 extends `aura_creator.social_account` and widens `goal_observation.source`. M06 writes observations with provider provenance and replaces `chartable()` inputs. M07 implements `AiOnboardingProvider` and `GrowthAssistant` and may replace rule-based action generation (the `source` column already separates `rule_based` and `growth_plan`). M08 adopts `aura_studio.idea` and the calendar entry. M09 owns publication and portfolio items (quick-create entry is disabled with a reason). M10 and M11 implement `OpportunitySource` and `CampaignRequirementEvaluator`. M12 supplies deliverables for the dashboard and search. M13 implements `CommercialSource`. M25 delivers notifications and the digest.
