# Brand onboarding (M14)

Gives every Brand workspace a private business profile, planning tools and a business verification case. It replaces the M10 interim verification process while keeping the same `aura_identity.workspace.verification` field, so every M10 and M11 gate keeps working unchanged.

## Data (`aura_brand`, private schema, RLS on, no policies, no grants)

| Table                                                                             | Purpose                                                                                                                                                              |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profile`                                                                         | Trading and public identity, business type, objective, stage, resources, agency label, public address and publication                                                |
| `product`, `segment`, `goal`, `guideline`, `budget`, `creator_pref`, `competitor` | Catalogue with approved claims, customer groups (hypothesis or confirmed), goals, guidelines, optional indicative budget, Creator preferences, competitor references |
| `social_account`                                                                  | The Brand's own accounts: manual, self-reported with a date, at most 10, never mixed with Creator accounts                                                           |
| `maturity`, `plan_item`                                                           | Answers to five questions (no score) and 7, 30 and 90-day plan steps                                                                                                 |
| `verification_case`, `verification_event`                                         | Cases (initial, resubmission, revalidation, appeal) with typed evidence and a full history                                                                           |
| `setting`, `reserved_slug`                                                        | Limits, the proposed evidence matrix, and words that cannot be public addresses                                                                                      |

## Verification

1. The Brand fills a case; the evidence needed depends on the business type (`evidence_matrix`). Only the last 4 characters of an identity document are stored.
2. Submitting needs complete evidence and a declaration. One open case per workspace.
3. A reviewer (Platform Admin + reviewer grant + MFA, never for their own workspace) approves, rejects or asks for information, always with a reason shown to the Brand. The email-domain match is shown as supporting evidence only.
4. Approval sets `workspace.verification = 'verified'` and records the decision in `aura_market.verification_decision` (the history the M10 Brand page shows).
5. After a rejection the Brand can start a new case or appeal once within 30 days; a different reviewer decides an appeal.
6. Changing the legal identity of a verified Brand opens a revalidation. Submitting it pauses commercial actions until approval; existing campaigns and agreements are not touched.

## Privacy

`aura_brand_public` (anonymous) and `aura_brand_public_for` (signed-in Creators) return only a published profile of an open, verified Brand: name, tagline, about, industry, country, website, active products and social handles. Legal identity, representatives, budgets, audiences, competitors, plans and preferences never leave the Brand workspace.

## Plans

`src/features/brand/rules.ts` proposes plan steps from what the Brand entered (each with a stable key and an explanation). `aura_brand_save_plan` replaces only untouched suggestions, so edited and completed steps survive a refresh.

## Screens

`/brand` (home), `/brand/onboarding`, `/brand/profile`, `/brand/products`, `/brand/audiences`, `/brand/goals`, `/brand/plan`, `/brand/guidelines`, `/brand/preferences/creators`, `/brand/competitors`, `/brand/socials`, `/brand/intelligence`, `/brand/verification`; public `/brand/[slug]`; reviewer `/admin/verification`. The Brand header (Home, Business, Verification, Campaigns, Inbox) is a minimal private landing, not the M15 navigation.
