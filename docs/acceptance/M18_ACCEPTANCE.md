# M18 acceptance (proposed checks from the reconstructed module file)

Evidence level: local PostgreSQL 16 with auth and storage stubs and the local stand-in for Supabase. **Not live Supabase.**

| Proposed check                                                              | Evidence                                                                                                                                                              | Status                     |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Concurrent selection cannot exceed available capacity                       | SQL group 2 (holds counted on every path, including M11 select); two concurrency tests (simultaneous holds for the last place; acceptance against a direct selection) | Met locally                |
| Expired reservations release capacity and applicable M22 budget reservation | SQL group 3 (an expired hold frees the place); M22 budgets are not built                                                                                              | Partly met (capacity only) |
| Selection does not create a binding agreement by itself                     | Offers, acceptances and the M12 hand-off are labelled as not binding; the M12 agreement still needs both acceptances and an approved template (SQL group 6)           | Met locally                |
| Unauthorized candidate data remains inaccessible                            | SQL groups 1 and 5 (other Brands, Creators and anonymous callers denied; notes never reach Creators; comparison from shared projections only); stack test             | Met locally                |
