# Social metric dictionary (M05)

Source of truth: `aura_social.metric_def` and `src/features/creator-social/metrics.ts` (drift is test-checked). Platform support is PROPOSED and must be confirmed against each provider's documentation before any integration. Freshness windows are proposed defaults awaiting owner approval.

Sixteen metrics: followers or subscribers, following, total posts, reach, impressions, profile views, account interactions, audience growth (net change), and content-level views, likes, comments, shares, saves, watch time, plays and clicks (see the file for exact platforms, shapes, ranges and freshness days).

Rules: unknown is never zero; zero is a real value; period totals need a period; lifetime and window values are never added; every value carries observed date and source (`manual` labelled self-reported); `ai_confirmed` can only be set through confirmation of an extraction suggestion; a metric not offered by a platform is "not available", not blank.
