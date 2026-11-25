# M06 — Creator analytics and insights

Status: business requirements approved; implementation details proposed.

## Functional requirements

- **M06-F01** Account, content, audience, growth diagnostics and commercial insights.
- **M06-F02** Manual and screenshot-assisted analytics without connected accounts, source labels.
- **M06-F03** Individual account views and consolidated activity without double-counting unique audiences.
- **M06-F04** 7, 30, 90 days, custom ranges and comparable prior periods.
- **M06-F05** Compare selected content using compatible metrics and windows.
- **M06-F06** AI patterns in topic, format, hooks, duration, timing and available attributes.
- **M06-F07** Organic and sponsored filters and meaningful comparisons.
- **M06-F08** Evidence-based publishing-time suggestions with confidence and limitations.
- **M06-F09** Evidence-based growth diagnostics and recommended experiments.
- **M06-F10** Prioritized insight feed with evidence, actions and links.
- **M06-F11** Growth Experiment Lab with hypotheses, baselines, tracking and learning history.
- **M06-F12** Optional structured content tags and AI classification.
- **M06-F13** Anonymized comparable peer cohorts only with sufficient reliable data.
- **M06-F14** No single creator quality or growth score.
- **M06-F15** Future competitor tracking using permitted public/authorized data.
- **M06-F16** Future suspicious-pattern indicators without unsupported fraud accusations.
- **M06-F17** Creator-controlled purpose-specific aggregate audience sharing.
- **M06-F18** Private diagnostics excluded from Brand-facing rankings.
- **M06-F19** Audience-to-campaign matching using permitted aggregates.
- **M06-F20** PDF summaries and CSV exports subject to permissions.
- **M06-F21** Scenario-based forecasts only with sufficient history and uncertainty.
- **M06-F22** Link commercial and organic analytics where authorized.
- **M06-F23** Core analytics free; advanced intelligence/reporting potentially premium.
- **M06-F24** Insufficient evidence: explain missing information and relevant collection/learning action.

## User journey
Select account/period → review evidence → compare content → identify insight → approve experiment → record results → update learning.

## Logical data entities
Metric definition, observation, measurement window, content tag, insight, experiment, baseline, result, cohort aggregate, sharing grant, report.

## Proposed screen inventory
Proposed `/creator/analytics`, `/creator/analytics/accounts`, `/creator/analytics/content`, `/creator/analytics/audience`, `/creator/analytics/compare`, `/creator/analytics/insights`, `/creator/experiments`, `/creator/analytics/reports`.

## Business rules and security
No sum of unique audiences across platforms without deduplication evidence. Missing data not zero. Compare same denominators and measurement windows. Cohorts suppress small samples. Private diagnostics never feed Brand rankings.

## Acceptance and negative tests
- M06-AC01: Manual observations display source/date and historical comparisons.
- M06-AC02: Incompatible metrics block misleading comparison.
- M06-AC03: Insufficient evidence returns helpful guidance rather than invention.
- M06-AC04: Experiment baseline and result preserved.
- M06-AC05: Sharing/export checks enforce purpose and current permission.
- M06-AC06: No composite score or unsupported fraud claim.

## Outstanding decisions / dependencies
Metric dictionary, cohort minimums, forecast thresholds, retention and advanced analytics scope pending.
