# M19 acceptance (proposed checks from the reconstructed module file)

Evidence level: local PostgreSQL 16 with auth and storage stubs and the local stand-in for Supabase. **Not live Supabase.**

| Proposed check                                                 | Evidence                                                                                                                            | Status      |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Delivery completion does not imply payment or campaign success | SQL group 4 (a completed collaboration with no recorded payment shows none); separate sections and labels; unit test                | Met locally |
| Reports preserve source, dates and metric definitions          | Every observation stores source, read date, window and side; the metric definitions are stored with each snapshot; CSV export test  | Met locally |
| Duplicate cumulative observations cannot inflate totals        | SQL group 3 (1000 then 1500 for one post counts 1500; a window of 300 is not added; void falls back); stack test (1,500, not 2,700) | Met locally |
| Revoked permissions prevent new report retrieval or export     | SQL group 5 (blocked view and export, logged); stack test (page refused, download 403, new version allowed)                         | Met locally |
