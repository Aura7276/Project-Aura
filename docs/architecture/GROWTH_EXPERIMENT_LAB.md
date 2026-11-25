# Growth Experiment Lab (M06)

Purpose: help a Creator test an idea and keep what they learn. It never publishes content, never starts an experiment for the Creator and never promises a result.

Lifecycle: draft → planned (optional) → active → completed, or cancelled from any open state. Starting is explicit, takes a lock, is refused if already active, is limited to three active experiments per workspace (proposed default), and freezes the baseline. A started experiment cannot be edited.

Baseline: observations the Creator selects (account or content observations, same account and metric), or a stated reason that none exists. Snapshots of value, date, window and source are stored at activation and never overwritten.

Measurement: observations must be the same metric and account, recorded after the start, and have the same window as the baseline. The result is a descriptive difference of medians (absolute, and relative only with a baseline above zero). No significance is computed. The experiment is described as not controlled; the Creator's own confounder notes are shown.

Outcomes: observed improvement, no clear difference, observed decline, inconclusive, insufficient evidence. The form pre-selects a descriptive suggestion; the Creator decides. Cancelling stores no outcome.

Learning history: hypothesis, preserved baseline, observations, outcome, interpretation, next experiment, tags. Private to the workspace. M07 and M08 may read it only when the Creator authorizes (contract in `contracts.ts`).

Templates (starting points, not strategies): question against statement hooks, duration, tutorial against lifestyle, publishing window, consistency.
