# Applications, invitations and negotiation (M11)

From a live M10 campaign to a collaboration that is **ready for an agreement**. M11 never creates an agreement; M12 prepares and records it.

## Data (`aura_apply`, private schema, RLS on, no policies, no grants)

- `campaign_rules`, `question`: Brand settings per campaign (quick apply, reapply, negotiable, submission and selection capacity) and up to 10 screening questions.
- `application`, `application_version`: one active application per Creator and campaign (unique partial index). Every submitted change is a new version; drafts overwrite their own version.
- `collaboration`: one prospective collaboration per campaign and Creator. Applications, invitations and the negotiation link to it (F32).
- `invitation`, `enquiry`, `clarification`: formal invitations (one open per Creator and campaign), preliminary enquiries, and questions with due dates.
- `proposal`, `confirmation`, `message`: versioned terms; a confirmation names a proposal row; any new proposal supersedes open ones, so earlier confirmations no longer count.
- `block`, `report`, `notification`, `event`, `setting`: Creator blocks, moderated reports, in-app notifications, the event history and non-production defaults.

## Rules enforced in the database

| Rule                       | Mechanism                                                                                      |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| Eligibility at submission  | `aura_market_check_apply` inside `aura_apply_submit`; again before "ready for agreement"       |
| One active application     | Unique index plus advisory lock per campaign and Creator                                       |
| Capacity                   | Advisory lock per campaign; submission and selection counted separately                        |
| Exact version confirmation | Confirm fails with `40001` unless the version is the current open one                          |
| Locking                    | First Brand action (review, question, decision) sets `locked_at`; edits are refused afterwards |
| No unpaid custom work      | Screening prompts that ask for new content for the Brand are refused                           |
| Verified outreach          | Invitations, enquiries and Brand proposals require approved verification                       |
| Rate limits                | Daily limits per workspace from `aura_apply.setting`                                           |
| Expiry                     | Invitations and proposals expire when read (`sweep`); no scheduler yet                         |

## Privacy

`aura_apply.shared()` builds the only Brand view of an application: pitch, answers, quote, the chosen account's platform, handle, ownership status and self-reported followers with date, the chosen public or restricted portfolio items and the chosen kit. Brands find Creators only by a published username (`aura_apply_find_creator`); workspace ids are never shown to them.

## Screens

Creator: `/creator/marketplace/[id]/apply`, `/creator/applications` (+ `/[id]`), `/creator/invitations` (+ `/[id]`), `/creator/enquiries` (+ `/[id]`), `/creator/negotiations/[id]`, `/creator/settings/applications`. Brand: `/brand/campaigns/[id]/applications`, `/brand/applications/[id]`, `/brand/inbox`, `/brand/negotiations/[id]`. Reviewer: `/admin/applications`.
