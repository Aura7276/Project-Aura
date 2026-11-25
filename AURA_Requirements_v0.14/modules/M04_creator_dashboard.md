# M04 — Creator dashboard

Status: business requirements approved; implementation details proposed.

## Functional requirements

- **M04-F01** Allow aspiring creators growth access; 100+ standard influencer discovery/campaign eligibility; separate UGC eligibility.
- **M04-F02** Growth-first with collaboration opportunities integrated.
- **M04-F03** Five navigation areas: Home, Grow, Create, Collaborate, My Studio.
- **M04-F04** Mobile bottom navigation and extended drawer.
- **M04-F05** Automatic personalization by goals, activity and segment.
- **M04-F06** Three to five relevant daily actions.
- **M04-F07** Persistent contextual AI assistant throughout Creator Studio.
- **M04-F08** Optional meaningful milestones and streaks without public leaderboards.
- **M04-F09** Weekly in-app review and optional email digest.
- **M04-F10** Individual goal tracking and evidence-based insights.
- **M04-F11** Personalized campaign recommendations with eligibility explanations.
- **M04-F12** Upcoming content, quick idea capture and calendar shortcut.
- **M04-F13** Agreed compensation, externally recorded payments and outstanding amounts with clear labels.
- **M04-F14** Universal quick-create for ideas, plans, portfolio and progress.
- **M04-F15** Skippable repeatable walkthrough.
- **M04-F16** Without Instagram prioritize growth plans, manual tracking, content tools and eligible opportunities; label unavailable metrics.
- **M04-F17** Global search own content, campaigns, collaborations, tools and resources.
- **M04-F18** Basic widget visibility initially; advanced rearrangement later.

## User journey
Enter Home → review goals/actions → complete tasks → create content → observe results → discover eligible opportunities → review progress.

## Logical data entities
Dashboard preference, daily action, milestone, goal observation, weekly review, recommendation, search index projection.

## Proposed screen inventory
`/creator/dashboard`, `/creator/actions`, `/creator/progress`, `/creator/recommendations`, `/creator/settings/dashboard`; quick-create, search, notifications, workspace switcher, walkthrough.

## Business rules and security
Personalization never grants permissions. Distinguish zero, unavailable, stale and self-reported data. No creator quality score; no fake wallet. Commercial widgets derive from M13.

## Acceptance and negative tests
- M04-AC01: No-account creator sees actionable dashboard without fake metrics.
- M04-AC02: Navigation works on desktop and mobile; persistent assistant respects workspace.
- M04-AC03: Daily actions and weekly review reflect authorized evidence.
- M04-AC04: Global search cannot retrieve other tenants’ records.
- M04-AC05: Widget visibility persists; walkthrough skippable; campaign eligibility explained.

## Outstanding decisions / dependencies
AI limits, digest delivery, milestone definitions, dashboard exact layout and search indexing pending.
