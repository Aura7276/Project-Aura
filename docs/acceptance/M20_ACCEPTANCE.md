# M20 acceptance: Brand AI Growth Assistant

Proposed checks from the recovered scope (no original acceptance criteria were recovered). Evidence: `tests/db/m20_rls.sql`, `tests/unit/db-m20.test.ts`, `tests/unit/m20-domain.test.ts`, `tests/stack/workflow-assistant.spec.ts`, screenshots in `docs/development/evidence/m20`.

| Check                                                                                                                            | Result                                            |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Another Brand, a Creator, an Agency or an anonymous caller cannot read a Brand's context, conversations or drafts                | Pass (SQL, stack 404)                             |
| Only ticked sources from the own workspace are shared; budget and competitors are opt-in; memory is off by default and deletable | Pass (SQL, stack)                                 |
| Draft actions need an explicit confirmation and a current Brand owner/admin with MFA; each draft applies once                    | Pass (SQL, stack)                                 |
| A brief draft changes only the campaign draft; the live campaign is unchanged                                                    | Pass (SQL)                                        |
| An unverified Brand cannot publish through the assistant; no assistant function publishes, invites, selects, confirms or pays    | Pass (SQL)                                        |
| Parallel requests never exceed the monthly allowance                                                                             | Pass (concurrency test)                           |
| With no provider, questions are kept, nothing is counted, and manual drafts and approvals work                                   | Pass (stack)                                      |
| Provider adapter: HTTPS only, no redirects, bounded request, failures never produce an answer                                    | Pass (unit, mocked network)                       |
| Real AI answers                                                                                                                  | Not tested: no provider is configured or approved |
