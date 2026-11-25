# AI and integration boundaries

Approved AI scope: M07, M08, M09–M14 domain-specific assistants. Server-side provider abstraction; route by task capability and budget. No provider selected. Use authorized tenant data, source metadata and uncertainty; keep private Creator and Brand intelligence separate. Explicitly provided style examples only. No secondary shared-model training by default. User review/edit/disable/delete-request for personalization; provider contract/retention controls need validation.

Proposed AI execution procedure: authorize workspace and task → collect minimal allowed context → sanitize untrusted external text/attachments → provider request with bounded tokens/time/cost → validate structured output → present evidence and editable draft → explicit approval for permitted record write → recheck permission/record version → commit idempotently → audit. Never use model output as permission decision. No auto application, proposal sending, agreement acceptance, approval, fund movement, commercial amendment or unapproved follow-up. Manual alternatives remain usable during outage/limits.

Integration register:
| Integration | Baseline status | Gate |
|---|---|---|
| Supabase Auth/Postgres/Storage | proposed stack, real configuration required | staging credential and RLS verification |
| Google login | approved | OAuth app and redirect configuration |
| Email/SMTP | required for verification and optional digest | real provider, delivery and unsubscribe tests |
| AI | provider-independent architecture approved | provider selection, privacy terms, quotas and quality tests |
| Screenshot/website extraction | approved with user confirmation | file and URL safety, provenance, no automatic approval |
| Trend sources | permitted current sources | rights, freshness and evidence validation |
| Instagram | deferred, first social integration | API approval, authorization and revocation tests |
| YouTube/other social | future | platform approval and demand |
| Google Calendar | later; initial calendar export | consent and scope |
| Publishing | future opt-in | supported API and explicit approvals |
| Payment/escrow/cross-border | deferred | authorized providers, legal/regulatory review |
| E-signatures | future | legal and technical validation |
| FX data | optional, source-labelled | provider selection and rate-date tests |

Never fabricate data when integration absent. Manual entry and source labels are the first-release path. No unauthorized scraping or password collection. Website import proposed SSRF protections: URL scheme allowlist, private/link-local IP deny, redirect and DNS revalidation, bounded response/time and content sanitization.
