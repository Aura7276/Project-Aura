# M07 — AI Growth Assistant

Status: business requirements approved; implementation details proposed.

## Functional requirements

- **M07-F01** Personalized creator growth agent with specialized capabilities.
- **M07-F02** Dedicated AI Studio, contextual assistant and proactive recommendations.
- **M07-F03** Works without social connections using onboarding/manual/provided context.
- **M07-F04** English, Hindi, Hinglish and supported regional languages.
- **M07-F05** Persistent editable intelligence profile, goals, preferences, feedback and history.
- **M07-F06** Editable 7-, 30-, 90-day plans.
- **M07-F07** Coaching conversations update approved goals and plans.
- **M07-F08** Adapt recommendations to completed actions, feedback and observed performance.
- **M07-F09** Proactively identify skill gaps and recommend learning/exercises.
- **M07-F10** Ideas, hooks, scripts, captions, CTAs, pillars and plans.
- **M07-F11** Text, image, carousel and supported video review; advanced media phased.
- **M07-F12** Learn style from explicitly provided examples and editable preferences.
- **M07-F13** Creative alternatives with explanations and refinement.
- **M07-F14** Future opt-in image/video generation subject to cost, quality and rights.
- **M07-F15** Permitted current trend sources with source and freshness.
- **M07-F16** Seasonal and regional opportunities personalized by niche/geography/language.
- **M07-F17** Future competitor content analysis using permitted material.
- **M07-F18** Brand opportunity evaluation: relevance, eligibility, deliverables and conflicts.
- **M07-F19** Indicative pricing/negotiation guidance and editable messages.
- **M07-F20** Personalized editable pitches from genuine information.
- **M07-F21** Read, recommend, draft; execute approved actions under existing permissions.
- **M07-F22** Convert approved ideas into records, calendar entries, tasks and experiments.
- **M07-F23** Scheduled daily/weekly recommendations and alerts with opt-out.
- **M07-F24** Future voice interaction after demand validation.
- **M07-F25** Review, edit, disable and request deletion of persistent AI personalization.
- **M07-F26** Private Creator conversations inaccessible to Brands.
- **M07-F27** No shared model training by default; separate explicit authorization for future secondary use.
- **M07-F28** Explain insufficient evidence and ask relevant questions or suggest collection.
- **M07-F29** Show relevant source information, reasoning summary and limitations.
- **M07-F30** Free core allowance; advanced/high-volume potentially premium.
- **M07-F31** Cost/capability-based model routing with provider independence.
- **M07-F32** Outage/limit: preserve drafts and conversations; transparent status and non-AI tools.

## User journey
Ask/receive recommendation → retrieve authorized context → generate source-labelled draft → review/edit → explicit approval for action → record feedback/outcome.

## Logical data entities
AI profile, conversation, message, recommendation, approved action, context reference, feedback, usage event, scheduled job, provider configuration.

## Proposed screen inventory
Proposed `/creator/ai`, `/creator/ai/plans`, `/creator/ai/history`, `/creator/ai/memory`, contextual assistant, action confirmation, usage/status settings.

## Business rules and security
Server-mediated tools with scoped authorization, no autonomous commercial commitments, no hidden sharing, no training by default. Treat retrieved data as untrusted; do not expose secrets. Use rationale summaries, not private model reasoning.

## Acceptance and negative tests
- M07-AC01: AI works with no social connection and labels uncertainty.
- M07-AC02: Unauthorized cross-workspace context cannot be retrieved.
- M07-AC03: Draft approval required before record changes; replay is idempotent.
- M07-AC04: Memory edit/disable/delete request supported; scheduled tasks opt out.
- M07-AC05: Provider outage preserves drafts and manual tools.
- M07-AC06: Usage limits enforce server-side; no fabricated credentials/results.

## Outstanding decisions / dependencies
AI provider, cost caps, languages, moderation, data retention, trend access and media analysis limits pending.
