# M01 delivery review

The owner authorized one M01 cycle. The supplied message ended at the section 8 heading. Implementation uses the visible brief, all seven approved M01 F IDs, the v0.14 proposed screen inventory and prior owner decisions. No M02 or M23 functionality was authorized. Local main remains at 14aab75. The remote advertised no refs; the feature branch isolates local work without a push or merge.

## Public experience

Visit http://127.0.0.1:3101/. The header, homepage and footer now connect audience pages, discovery, a product walkthrough, resources, pricing, features, about and support. The Agency page covers service models, talent rosters, client ownership, explicit delegation, multi-client coordination, reporting and commercial management as planned capabilities. The walkthrough has eight Creator and seven Brand steps, direct step selection, previous/next and restart. Articles cover media kits, a content experiment and creator briefing. Legal pages state pending approval and make no contractual claims. Existing audience pages, visual assets and design-system controls remain in place.

## Requirement disposition

| ID      | Public implementation                                                                                                     | Outstanding integration or decision                                                                                                                                |
| ------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M01-F01 | Anonymous directory and profile detail. Explicit public column allowlist, response validation and uncached reads.         | M09 must supply real creator-controlled publication, revocation, suspension and database-enforced public projection.                                               |
| M01-F02 | Campaign directory and limited detail. No application mutation. Development sign-in readiness can return to the campaign. | M10 controls publication and eligibility. M02 must preserve context across real authentication and repeat checks before application.                               |
| M01-F03 | Free-start messaging on homepage, audience pages, FAQ and pricing.                                                        | Paid tiers and entitlements remain M27 decisions.                                                                                                                  |
| M01-F04 | Three original educational articles with index, category navigation and unknown-article 404.                              | Editorial review during acceptance.                                                                                                                                |
| M01-F05 | Two navigable public walkthroughs with labelled illustrations.                                                            | Owner review of the journey copy.                                                                                                                                  |
| M01-F06 | Support centre, FAQ, validated local enquiry form and optional email-app handoff.                                         | Set AURA_SUPPORT_EMAIL to an owner-approved mailbox and confirm real receipt. No server delivery, ticket queue or M30 resolution workflow is claimed.              |
| M01-F07 | Bounded invitation route and development registration context; no reward or attribution claim.                            | Issuance by an authorized Creator, code lookup, redemption and duplicate/self-referral protection require M02 and approved attribution/reward rules including M27. |

## Publication contract and release gate

The optional server-only integration reads Supabase PostgREST with the public publishable key. By default AURA_PUBLIC_PROJECTIONS_ENABLED is false. Configure the existing provider environment only for a real staging project. The proposed interfaces are m01_public_creator_previews(slug, display_name, bio) and m01_public_campaign_previews(slug, title, summary). Each slug must uniquely resolve to a single published record. The DB must supply only explicitly allowed public fields and current, eligible, unsuspended publications. No privileged key or private base-table fallback. Lists show up to 24 previews. The adapter distinguishes empty results from outages at list level and fails closed for detail access.

Before enabling, verify publication, unpublication, suspension, private campaign exclusion and immediate cache removal through the anonymous API and page routes in real staging. Test actual M02 context restoration, eligibility, replay and referral abuse when the owners of those modules implement them. Unit fixtures exercise adapter behavior only. M30 legal and contact operations and final indexing policy remain pending.

## Manual acceptance

Follow both walkthroughs by keyboard; open each article; switch between mobile and desktop menus. Inspect the Agency placeholder, ownership language, pricing and legal readiness. Verify contact draft preparation and separately confirm mailbox delivery once configured. Treat provider- and identity-dependent launch checks as blocked. Review the individually tracked F IDs before approving M01 or authorizing M02.

## Execution evidence

Frozen install, formatting validation, ESLint, strict TypeScript checking, production build and dependency audit passed. Vitest passed 14 tests. Chromium Playwright passed 47 tests with zero failures and zero skips in the final run. Tests included both complete walkthroughs, draft preparation, internal invitation return context, fail-closed direct routes and production navigation. New axe and mobile overflow checks passed at 320px on /agencies, /demo, /contact, /resources and /pricing. Earlier runs exposed a test locator that also matched the Next route announcer and a superseded privacy readiness assertion; the final suite uses the main landmark and checks the actual legal approval status. These checks do not verify hosted authorization, a real inbox or live referral redemption.

Captured pages: [Agency](evidence/m01-module-agencies.png), [walkthrough](evidence/m01-module-demo.png), [resources](evidence/m01-module-resources.png).
