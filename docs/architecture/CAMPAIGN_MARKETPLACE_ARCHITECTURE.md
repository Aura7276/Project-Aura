# Campaign marketplace architecture (M10)

## Scope decision

Campaigns come from Brands, and the approved requirements say every publication needs business verification (M10-F27, M14-F34). M14 (Brand onboarding) is not built and the Brand authoring workflow (M17/M18) is not approved. To make the marketplace real without inventing anything, M10 includes:

1. The complete Creator marketplace.
2. A minimal Brand campaign editor (draft, versioned terms, publish, pause, close, invitations) at `/brand/campaigns`.
3. **Interim business verification**: a restricted reviewer (Platform Admin + reviewer grant + MFA, no self-review, reason required, audited) sets the existing M02 field `aura_identity.workspace.verification`. M14 replaces this with its full process. **Owner approval needed.**

## Layers

| Layer                                                                                              | Location                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database (`aura_market`, RLS on, no policies, no grants, `SECURITY DEFINER` with `search_path=''`) | `supabase/migrations/20261202000100_m10_campaign_marketplace.sql`                                                                                                                                                           |
| Domain                                                                                             | `src/features/marketplace/` (`rules`, `assessment`, `compare`, `empty`, `schemas`)                                                                                                                                          |
| Server                                                                                             | `src/server/market/service.ts` (incl. `brandContext`), `src/features/marketplace/actions.ts`                                                                                                                                |
| Creator UI                                                                                         | `/creator/marketplace` (For You), `/explore`, `/category/[type]`, `/[id]`, `/[id]/eligibility`, `/[id]/assessment`, `/[id]/updates`, `/saved`, `/recent`, `/compare`, `/searches`, `/alerts`, `/preferences`, `/brand/[id]` |
| Brand UI                                                                                           | `/brand/campaigns`, `/brand/campaigns/[id]`                                                                                                                                                                                 |
| Reviewer                                                                                           | `/admin/marketplace`                                                                                                                                                                                                        |
| Public                                                                                             | `public.m01_public_campaign_previews` (slug, title, summary) for M01's existing pages                                                                                                                                       |

## Rules enforced by the database

- **Publication**: verified Brand only, at every visibility; invitations too. A Brand's first publication, fee language, off-platform contact details and exclusivity over 180 days go to human review first.
- **Disclosure**: paid needs an amount or range; affiliate needs a commission rate; barter, UGC and ambassador need some compensation; events need the experience; rights disclosed or marked negotiable; exclusivity at most 365 days; positions a real number or undisclosed; UGC cannot set a follower minimum; there is no fee field.
- **Visibility**: public to signed-in Creators; restricted only to Creators meeting every mandatory requirement; invitation-only only to invited Creators. A direct URL cannot bypass any of these. Paused, closed, removed, expired and unverified-Brand campaigns disappear immediately.
- **Eligibility**: mandatory requirements (followers on one individual account, never summed; platforms; verified ownership; country; language) decide; preferred attributes only explain relevance. Missing data is "unknown" with a reason. Re-checked at the apply boundary.
- **Versions**: editing a live campaign creates a new draft version; the live one is unchanged until republished. Material changes (compensation, deliverables, rights, requirements, deadline, positions, travel, countries, languages, remote) are listed and notified to Creators who saved the campaign. Every published version is kept.

## Ordering without a score

For You orders by explained factors (eligible, matches your collaboration interests, fits your niche, suited to creators still building an audience, Brand welcomes beginners, closes soon). The factors are shown on each card; no number is shown; verification is never a factor. At most two campaigns per Brand appear in the first twelve.

## Not built

Applications (M11; the eligible state says so), agreement re-validation (M12), AI assessment (M07), email alerts (M25), promoted placements and pricing (M27), applicant counts (need applications), Brand feedback (needs completed collaborations).
