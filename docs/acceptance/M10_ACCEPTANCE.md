# M10 acceptance

Evidence level: local PostgreSQL 16 with auth and storage stubs and the local stand-in for Supabase. **Not live Supabase.**

| ID       | Criterion                                                  | Evidence                                                                                                                                                                    | Status                             |
| -------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| M10-AC01 | Visibility and eligibility enforced at API and database    | SQL group 5 (restricted, invitation-only, direct URL, apply check), group 10 (tenant isolation); stack test                                                                 | Met locally                        |
| M10-AC02 | UGC can qualify without the influencer follower minimum    | SQL group 4 (UGC cannot set a minimum) and 5 (a Creator with no account qualifies); stack test shows UGC first for a new Creator                                            | Met locally                        |
| M10-AC03 | Compensation types and actual counts accurately labelled   | Separate compensation lines, only money called guaranteed, positions undisclosed when unknown, applicant counts not shown until applications exist (domain and stack tests) | Met locally                        |
| M10-AC04 | Material version changes notify affected users             | SQL group 7; stack test (Brand raises the range, the Creator who saved it gets "Terms changed")                                                                             | Met locally                        |
| M10-AC05 | Unverified Brand cannot publish any visibility type        | SQL group 2 (all three visibilities and invitations refused); stack test (Publish disabled until verified)                                                                  | Met locally (interim verification) |
| M10-AC06 | AI cannot apply; blocking, reporting and empty states work | No AI path exists; hiding and reporting (SQL groups 6 and 9, stack test); explained empty states                                                                            | Met locally                        |

Not verified: live Supabase, M14 verification process (interim reviewer used), applications (M11).
