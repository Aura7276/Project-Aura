# M14 acceptance

Evidence level: local PostgreSQL 16 with auth and storage stubs and the local stand-in for Supabase. **Not live Supabase.**

| ID       | Criterion                                                          | Evidence                                                                                                                                                        | Status                                   |
| -------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| M14-AC01 | A zero-social Brand can use private growth and planning            | SQL group 2 (goals and plans with no accounts); domain test (first-week plan for a Brand with no presence); stack test (onboarding to plan without any account) | Met locally                              |
| M14-AC02 | Brand workspaces cannot access each other's information            | SQL groups 1 and 10 (another Brand cannot read, edit or delete; Creators and Agencies denied); no table grants                                                  | Met locally                              |
| M14-AC03 | An unverified Brand is blocked from publishing, invites, enquiries | SQL groups 6 and 8 (campaign publishing and profile publishing refused, including during revalidation); M10 and M11 gates unchanged and re-run                  | Met locally                              |
| M14-AC04 | Verifying one workspace does not verify another                    | SQL group 6 (approval of Brand c leaves Brand c2 pending)                                                                                                       | Met locally                              |
| M14-AC05 | Privileged MFA enforced; an Agency label grants no access          | SQL group 1 (non-MFA owner cannot write; Agency workspace denied); agency name stored as a label only                                                           | Met locally                              |
| M14-AC06 | AI-extracted claims and personas need confirmation and provenance  | No AI extraction exists; audiences carry a hypothesis or confirmed label; claims are entered by the Brand                                                       | Not applicable until M07 (contract only) |
| M14-AC07 | Budget optional at onboarding, no spend commitment                 | SQL group 3 (no budget needed, clearable); stack test (budget labelled indicative)                                                                              | Met locally                              |
| M14-AC08 | Account limit of 10 and private-by-default publication             | SQL groups 4 and 9; concurrency test (simultaneous additions stop at 10); stack test (profile private until published, 404 after unpublishing)                  | Met locally                              |

Not verified: live Supabase, file uploads (logos, documents), AI features (M07), reminders (M25), the role matrix (M26).
