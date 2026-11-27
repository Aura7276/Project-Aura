# M01 public navigation

The homepage, Creator, Brand, Agency, feature overview, walkthrough, pricing, about, library, three resource articles, FAQ, support and contact pages are public routes. The legal routes state their approval status. The same typed destination map supplies the header, mobile menu, dropdowns and footer.

Creator and campaign discovery routes are accessible. Dynamic details depend on a restricted publication feed and fail closed when unavailable. Referral entry is accessible; creation, verified attribution and anti-abuse enforcement require later services. Contact delivery requires an approved mailbox.

Login and registration link to readiness only in development and are pending in production. Production denies /dev and /readiness routes. Internal handoff context is allowlisted to campaign or invite paths. Authenticated transitions remain M02 work.

## M04 Creator Studio navigation

Authenticated Creator Studio uses a typed configuration (`creator-studio/nav.ts`) with five areas. Available destinations: Home `/creator/dashboard`; Grow `/creator/grow` with `/creator/actions`, `/creator/progress` and the M03 social accounts form; Create `/creator/create`; Collaborate `/creator/recommendations`; My Studio `/creator/studio` with the M03 profile, `/creator/settings/dashboard`, M02 `/security` and `/workspaces`. Search `/creator/search` and notifications `/creator/notifications` are header destinations. Planned and not linked: Analytics (M06), Growth Assistant (M07), Content Studio and calendar (M08), Marketplace (M10), Applications (M11), Collaborations (M12), Media kit (M09) and Earnings (M13). A unit test fails if an available item has no route or a planned item has a link.

## M05

Grow > Social accounts now points to `/creator/socials` (available). Analytics remains planned (M06).

## M06

Grow > Analytics (`/creator/analytics`) and Experiments (`/creator/experiments`) are available. The earlier planned M06 entry is replaced.

## M09

My Studio: Profile and media kit (`/creator/profile`), Portfolio and Media kits are available. The planned M09 entry is replaced.

## M10

Collaborate → Campaign marketplace (`/creator/marketplace`) is available. Brand campaigns live at `/brand/campaigns`; the reviewer page is `/admin/marketplace`.

## M11

Collaborate → Applications and invitations (`/creator/applications`) is available. The campaign page's "Check and apply" opens the application form. Brands have an Inbox (`/brand/inbox`) and an applications page per campaign; the reviewer report queue is `/admin/applications`.

## M14

Brands get a private home at `/brand` with setup, plans and verification, and a header with Home, Business, Verification, Campaigns and Inbox. Business pages share a tab row (Profile, Products, Audiences, Goals, Plan, Guidelines, Creators, Competitors, Socials, Brief). The public profile is `/brand/[slug]`. Reviewers use `/admin/verification`. The workspace page links to Brand setup. This is not the M15 navigation.

## M17

`/brand/campaigns` is now a management list (filters, numbers, duplicate, archive). Each campaign has tabs: All terms, Builder, Preview, Applications, Changes.

## M18

The campaign Applications tab is now an inbox with views and comparison; candidates have Place and Team notes panels; Creators see offers on their application page; both negotiation pages link to the collaboration workspace once both sides confirm.
