# Campaign creation and management (M17)

M17 extends the M10 campaign store (`aura_market`) rather than replacing it. Terms, versions, visibility, moderation and material-change detection stay in M10; M17 adds planning, rollout, management and stronger change handling.

## Data (`aura_campaign`, private schema, RLS on, no policies, no grants)

- `setting`: `category_rollout` (paid, UGC, barter live; events, ambassador, affiliate planned) and limits.
- `plan`: one private plan per campaign: objective, KPI, M14 audiences and products, owner, milestones, notes, archive flag. Never shown to Creators.
- `amendment`: one row per published material change: what changed and how many Creators were told.

## Guards on the M10 tables (cannot be bypassed)

- `m17_guard_publish` (before update on `aura_market.campaign`): a planned category cannot be published or sent to review; published positions can never be fewer than the Creators already selected. It takes the same per-campaign lock as M11 selection, so a cut in positions and a selection cannot interleave.
- `m17_version_published` (after update on `aura_market.campaign_version`): a material change notifies applicants and Creators in negotiation (M10 already notifies Creators who saved it) and logs the amendment. Agreed M11 proposals keep their own terms.

## Builder

Six steps at `/brand/campaigns/[id]/build`: objective and audience (the plan), brief, deliverables, compensation and rights, eligibility, preview and publish. Steps 2 to 5 reuse the M10 editor action and fields; the fields of other steps travel as hidden values so a step never blanks the rest. M10 draft validation now accepts empty summary, brief, deliverables and closing date (completeness is checked by the database before publication). The brief can be prefilled from what the Brand confirmed in M14 (products, claims, audiences, guidelines); nothing is generated or invented.

## Screens

`/brand/campaigns` (management list with filters, numbers, duplicate, archive), `/brand/campaigns/[id]` (all terms, M10), `/build`, `/preview`, `/applications` (M11), `/changes`. Creators see open places on the campaign page.
