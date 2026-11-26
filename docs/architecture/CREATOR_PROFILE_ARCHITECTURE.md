# Creator profile and media kit architecture (M09)

## Principles

- **Private by default.** Nothing leaves the database unless the Creator publishes the profile or creates a link. Unpublishing, revoking, expiry and workspace suspension take effect on the next read.
- **Projections, never copies.** Public pages call `aura_public_profile` and `aura_public_kit`, which build an allowlisted view on every request and re-check publication, item visibility, link validity, recipient membership and workspace status. A stored kit snapshot is re-filtered by each item's current visibility at read time.
- **Honest labels.** Speculative work, self-reported experience and outcomes, self-reported follower counts (with dates), and per-account ownership are labelled exactly. There is no rating or composite score anywhere.

## Layers

| Layer                                                                                               | Location                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database (`aura_profile`, RLS on, no policies, no grants, `SECURITY DEFINER` with `search_path=''`) | `supabase/migrations/20261201000100_m09_creator_profile.sql`                                                                                                                                                                                                                              |
| Domain rules                                                                                        | `src/features/creator-profile/` (`rules`, `schemas`, `completeness`, `optimize`, `qr`, `pdf`)                                                                                                                                                                                             |
| Server                                                                                              | `src/server/profile/service.ts`, actions in `actions.ts` and `site-actions.ts`                                                                                                                                                                                                            |
| Studio UI                                                                                           | `/creator/profile` (+ edit, appearance, preview, completeness, experience, reviews, verification, privacy, optimize, analytics, availability), `/creator/portfolio`, `/creator/services`, `/creator/rates`, `/creator/rates/packages`, `/creator/media-kit` (+ new, edit, share, history) |
| Public UI (`(site)` route group, minimal chrome)                                                    | `/creator/[username]`, `/kit/[token]`, `/kit/[token]/pdf`, `/feedback/[token]`                                                                                                                                                                                                            |
| Reviewer                                                                                            | `/admin/profile-reviews` (Platform Admin + reviewer grant + MFA, reusing M05's rule)                                                                                                                                                                                                      |

## Visibility model

| Item                               | Public profile      | Public kit link | Restricted kit link                                                            |
| ---------------------------------- | ------------------- | --------------- | ------------------------------------------------------------------------------ |
| Portfolio, experience (public)     | yes                 | yes             | yes                                                                            |
| Portfolio, experience (restricted) | no                  | no              | yes                                                                            |
| Private items                      | no                  | no              | no                                                                             |
| Service names                      | if public           | if public       | if public or restricted                                                        |
| Service prices                     | never               | never           | only when the link includes rates and the price is marked for restricted links |
| Packages                           | never               | never           | if restricted, prices only when the link includes rates                        |
| Audience (M06 snapshots)           | never               | never           | when the section is enabled                                                    |
| Testimonials                       | approved and chosen | same            | same                                                                           |

## Links and tokens

Tokens are 128+ bits from two `gen_random_uuid` values, shown once, stored only as SHA-256 hashes. Restricted links name a Brand or Agency workspace; the viewer must be signed in as an active member. Restricted links expire after 30 days by default; public links only if the Creator sets an expiry. The QR code encodes the link itself, so revoking the link stops the QR. Downloaded PDFs are copies and cannot be recalled (stated on every kit).

## Usernames

`^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$`, no doubled punctuation, case-insensitive unique. Every Creator Studio segment under `/creator/` and system words are reserved (database list mirrored in TypeScript; a test checks every Studio route folder is reserved). An old username redirects for 30 days and cannot be claimed by others meanwhile. Three changes per 30 days.

## Discovery (M01 directory)

`public.m01_public_creator_previews` (slug, display_name, bio) lists only published, listed profiles in open workspaces that meet the discovery rule (one individual account with 100+ followers, never summed). The rule is inlined in the view because functions in a view run with the caller's privileges.

## Analytics and identity

Daily aggregate counts per profile and per link. No IP address, user agent or visitor identity is stored, and the Creator's own visits are not counted. A Brand is named to the Creator only when one of its signed-in members chooses "let the creator know".

## Contracts (not built)

Enquiries (need M14 Brand verification; the function always refuses), uploads and cover images (need a private bucket and malware scanning), M08 Content Studio records (field reserved), AI kit writing and suggestions (M07), branding removal and capacity tiers (M27), custom domains.
