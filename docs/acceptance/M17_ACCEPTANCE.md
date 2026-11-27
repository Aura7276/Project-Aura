# M17 acceptance (proposed checks from the reconstructed module file)

Evidence level: local PostgreSQL 16 with auth and storage stubs and the local stand-in for Supabase. **Not live Supabase.** The module file lists proposed checks, not original acceptance IDs.

| Proposed check                                                                               | Evidence                                                                                                              | Status                                |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Unverified Brand cannot publish or invite through any interface                              | M10, M11 and M14 SQL suites re-run on the M17 schema; builder readiness blocks publishing                             | Met locally                           |
| Public preview only exposes approved fields; private campaigns cannot be fetched anonymously | M10 suite re-run; the M17 plan never appears in the Creator view (SQL group 3, stack test)                            | Met locally                           |
| Material edits are versioned and do not alter accepted agreements                            | SQL group 5 (versioned, logged, notifications); M11 proposals keep their terms                                        | Met locally for M11; M12 link pending |
| Campaign category availability matches rollout readiness                                     | SQL group 2 (planned types draft-only, publishing blocked by a trigger); stack test (event draft cannot be published) | Met locally                           |
