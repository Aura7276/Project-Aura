# M05 acceptance

Evidence level: local PostgreSQL 16 with auth/storage stubs and a stand-in for Supabase. **Not live Supabase.**

| ID       | Criterion                                                                             | Evidence                                                                                           | Status                                                     |
| -------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| M05-AC01 | Add accounts within the limit; primary and preferred are atomic                       | SQL scenarios, 6-way concurrent add test, primary/preferred concurrency tests, stack test add flow | Met locally                                                |
| M05-AC02 | Ownership verification with challenge and restricted review; no auto-verification     | SQL scenarios (MFA, self-approval refused, disputes, revocation), stack test reaches Under review  | Met locally; evidence upload not verified (off by default) |
| M05-AC03 | Metrics recorded with date and source; corrections preserve history; freshness honest | SQL, domain tests, stack record/correct flow                                                       | Met locally                                                |
| M05-AC04 | Private by default; sharing is explicit and revocable; cross-tenant access denied     | RLS/grant inspection, cross-tenant SQL scenarios                                                   | Met locally                                                |
| M05-AC05 | Unavailable integrations are labelled; nothing is simulated                           | Contracts only, UI wording, tests                                                                  | Met                                                        |

Not verified: live Supabase, Storage upload, real MFA tokens, providers, AI extraction, email reminders, malware scanning.
