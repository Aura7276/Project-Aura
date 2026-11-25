# M08 — Content ideation and planning

Status: business requirements approved; implementation details proposed.

## Functional requirements

- **M08-F01** Ideas combine goals, niches, history, analytics and permitted trends.
- **M08-F02** Persistent searchable tagged idea library for manual, AI and reference-based ideas.
- **M08-F03** Editable content pillars, suggestions and optional target mix.
- **M08-F04** Permitted external inspiration links, notes and original adaptations.
- **M08-F05** Optional production effort, equipment and time estimates.
- **M08-F06** Daily, weekly, monthly and agenda calendar views.
- **M08-F07** Manual and AI-generated editable weekly/monthly plans.
- **M08-F08** Unified organic/commercial calendar with separate filters and permissions.
- **M08-F09** Ideation, recording, editing, review and publication activities.
- **M08-F10** Reusable recurring series and editable schedules.
- **M08-F11** Calendar export initially; Google Calendar later.
- **M08-F12** Scripts, captions, hooks, CTAs, hashtags, storyboards, shot lists and checklists.
- **M08-F13** Format-specific templates for Reels, Shorts, Carousels, Stories and others.
- **M08-F14** Autosave, meaningful version history and restoration.
- **M08-F15** Optional prepublication AI review of clarity, originality, relevance and brief compliance.
- **M08-F16** Reusable editable creative and production templates.
- **M08-F17** Flexible stages; skip nonessential stages.
- **M08-F18** Kanban production board with editable states and transition rules.
- **M08-F19** Configurable reminders, deadlines and missed-task notifications.
- **M08-F20** Reusable and AI-suggested editable checklists.
- **M08-F21** Private asset library subject to quotas.
- **M08-F22** Images, supported videos, documents, links and notes within file limits.
- **M08-F23** Purpose-specific AI access to uploaded assets.
- **M08-F24** Linked independently editable content adaptations.
- **M08-F25** Manual publication checklist, copy-ready content and actual published URL.
- **M08-F26** Future opt-in direct scheduling/publishing via supported APIs.
- **M08-F27** Link campaign briefs, deadlines, tasks and submissions while preserving private drafts.
- **M08-F28** Sponsored-content disclosure and brief-compliance reminders/checks.
- **M08-F29** Associate publication with manual or API performance observations.
- **M08-F30** Future recommendations from evidence, goals and experiment outcomes.
- **M08-F31** Unpublished drafts accessible only to Creator and explicitly authorized collaborators; Brands see designated submissions.
- **M08-F32** Core planning/editing/ideas free; advanced AI/storage potentially premium.

## User journey
Discover → develop → draft → schedule → produce → review → publish manually → associate performance → learn.

## Logical data entities
Idea, pillar, content item, draft/version, event, task, asset, series, adaptation, publication, performance association, commercial association, reminder.

## Proposed screen inventory
`/creator/content`, `/discover`, `/generate`, `/ideas`, `/ideas/[id]`, `/pillars`, `/calendar`, `/new`, `/[id]`, `/[id]/script`, `/[id]/caption`, `/[id]/storyboard`, `/production`, `/assets`, `/[id]/repurpose`, `/[id]/review`, `/[id]/history`, `/[id]/publish`, `/published`, `/templates`, `/series`, `/settings` (relative to content root where appropriate).

## Business rules and security
Production state independent of contract approval. Proposed idea/planned/drafting/production/editing/review/revision/ready/published/analyzed/paused/archived/cancelled. Planned date not actual publication. Calendar edits cannot silently change contractual deadlines.

## Acceptance and negative tests
- M08-AC01: Drafts autosave and restore versions.
- M08-AC02: All four calendar views and recurring edits work.
- M08-AC03: Private assets and unrelated drafts denied to Brand.
- M08-AC04: Repurposing preserves original.
- M08-AC05: Publication must record actual evidence, not scheduled status.
- M08-AC06: Campaign review cannot be bypassed via board transitions.
- M08-AC07: AI outage leaves manual tools available.

## Outstanding decisions / dependencies
Storage/file limits, revision retention, reminders and exact transition policy pending.
