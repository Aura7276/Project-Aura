# Analytics metric dictionary (M06)

Authority: M05's `aura_social.metric_def` (codes, units, ranges, platforms). M06 adds versioned semantics in `aura_analytics.metric_semantics` (version 1, effective 2026-01-01) and derived calculations in `aura_analytics.derived_def`. A changed definition adds a version; observations are read under the version effective on their observation date, so history keeps its original meaning. TypeScript mirrors are in `semantics.ts` and `engagement.ts`; drift is test-checked.

| Metric                                                                            | Meaning                       | Window             | Allowed aggregation                                | Note                                   |
| --------------------------------------------------------------------------------- | ----------------------------- | ------------------ | -------------------------------------------------- | -------------------------------------- |
| followers                                                                         | Audience count on the date    | snapshot           | per account; sum labelled "possible overlap"       | Not unique people                      |
| following                                                                         | Accounts followed             | snapshot           | per account                                        |                                        |
| posts_total                                                                       | Lifetime published count      | cumulative         | per account; sum                                   |                                        |
| reach                                                                             | Unique accounts reached       | interval           | per account only                                   | Never summed                           |
| impressions                                                                       | Times displayed               | interval           | per account; sum over non-overlapping same windows | Not reach                              |
| profile_views                                                                     | Profile visits                | interval           | same                                               |                                        |
| interactions                                                                      | Platform-defined interactions | interval           | same                                               | Not comparable across platforms        |
| audience_growth                                                                   | Net change                    | interval           | same                                               |                                        |
| views, c_reach, c_impressions, likes, comments, shares, saves, watch_time_seconds | Content metrics               | lifetime or window | per content                                        | Lifetime and window are never compared |

## Derived calculations

- Engagement by reach (content) = (likes + comments + shares + saves) / content reach, same window and date.
- Engagement by views (content) = same numerator / views.
- Account engagement by reach = interactions / reach over the same period.
- Account engagement by followers = interactions over the period / followers at the latest snapshot inside it.
  Percentages are rounded to two decimals. A partial numerator, a missing denominator or a zero denominator gives "not available".

## Unresolved decisions (owner)

Platform support per metric is proposed and unverified against each provider. Whether lifetime content totals should ever be compared at age bands other than 25 percent. Freshness days per metric. Which interaction types each platform includes. Whether "audience_growth" should be derivable from two follower snapshots (not done: it stays a separately recorded value).
