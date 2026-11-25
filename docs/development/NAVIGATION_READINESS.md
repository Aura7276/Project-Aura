# M01 public navigation

The homepage, Creator, Brand, Agency, feature overview, walkthrough, pricing, about, library, three resource articles, FAQ, support and contact pages are public routes. The legal routes state their approval status. The same typed destination map supplies the header, mobile menu, dropdowns and footer.

Creator and campaign discovery routes are accessible. Dynamic details depend on a restricted publication feed and fail closed when unavailable. Referral entry is accessible; creation, verified attribution and anti-abuse enforcement require later services. Contact delivery requires an approved mailbox.

Login and registration link to readiness only in development and are pending in production. Production denies /dev and /readiness routes. Internal handoff context is allowlisted to campaign or invite paths. Authenticated transitions remain M02 work.

## M04 Creator Studio navigation

Authenticated Creator Studio uses a typed configuration (`creator-studio/nav.ts`) with five areas. Available destinations: Home `/creator/dashboard`; Grow `/creator/grow` with `/creator/actions`, `/creator/progress` and the M03 social accounts form; Create `/creator/create`; Collaborate `/creator/recommendations`; My Studio `/creator/studio` with the M03 profile, `/creator/settings/dashboard`, M02 `/security` and `/workspaces`. Search `/creator/search` and notifications `/creator/notifications` are header destinations. Planned and not linked: Analytics (M06), Growth Assistant (M07), Content Studio and calendar (M08), Marketplace (M10), Applications (M11), Collaborations (M12), Media kit (M09) and Earnings (M13). A unit test fails if an available item has no route or a planned item has a link.
