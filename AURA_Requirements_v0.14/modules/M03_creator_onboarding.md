# M03 — Creator onboarding

Status: business requirements approved; implementation details proposed.

## Functional requirements

- **M03-F01** Minimum 100 followers for standard influencer eligibility; M04 clarification allows aspiring creators below 100 or without accounts to register and use growth tools; UGC eligibility separate.
- **M03-F02** Short mandatory onboarding then progressive completion.
- **M03-F03** No social account required at registration.
- **M03-F04** Instagram, YouTube, Facebook, LinkedIn, Threads and other supported links.
- **M03-F05** Personal, Creator and Business Instagram accounts accepted.
- **M03-F06** Multiple accounts per platform with one overall primary.
- **M03-F07** Manual information and optional screenshots.
- **M03-F08** One primary niche and multiple secondary niches.
- **M03-F09** Structured questionnaire plus optional AI conversation.
- **M03-F10** Measurable follower, engagement, consistency and monetization goals.
- **M03-F11** Optional time, equipment and budget assessment after onboarding.
- **M03-F12** Paid, UGC, barter, affiliate, ambassador and event opportunities.
- **M03-F13** Optional editable rates per format.
- **M03-F14** No previous commercial experience required.
- **M03-F15** Explicit industry preferences and exclusions.
- **M03-F16** Private profile until explicitly published.
- **M03-F17** Verification optional initially, mandatory for designated commercial activities.
- **M03-F18** Private goals/challenges/targets restricted to creator and authorized processing.
- **M03-F19** Personalized growth plan, profile checklist and recommended opportunities.
- **M03-F20** Editable information, periodic reminders and authorized automated refresh.

Source note: reconstructed from prior decision summaries; numbering is a new local mapping, not an exact transcript. Confirm against original decisions if available.

## User journey
Basic identity → social account or aspiring path → niche → goals/challenges → commercial preferences → review → activate → progressive enrichment.

## Logical data entities
Creator profile, onboarding session, niche, goal, preference, exclusion, resource assessment, growth plan.

## Proposed screen inventory
`/onboarding/creator` with identity, socials, niche, goals, preferences, review, completion, optional AI conversation and progressive profile/checklist screens.

## Business rules and security
At least one relevant individual account with 100+ followers for standard influencer privileges (M05); never sum followers to qualify. Separate UGC eligibility. Private by default. No fabricated metrics. Proposed segments 0–99/no account, 100–999, 1k–4,999, 5k–9,999, 10k–19,999, 20k+.

## Acceptance and negative tests
- M03-AC01: Aspiring creator completes onboarding without social account.
- M03-AC02: 100-follower rule enforced independently of workspace activation.
- M03-AC03: Optional questions can be skipped and resumed.
- M03-AC04: Goals and excluded industries persist and inform authorized recommendations.
- M03-AC05: No private onboarding data is publicly exposed.

## Outstanding decisions / dependencies
Exact mandatory field list, verification triggers and AI provider pending.
