# M21 acceptance: Brand Content and Social Planning

Proposed checks from the recovered scope (no original acceptance criteria were recovered). Evidence: `tests/db/m21_rls.sql`, `tests/unit/db-m21.test.ts`, `tests/unit/m21-domain.test.ts`, `tests/stack/workflow-content.spec.ts`, screenshots in `docs/development/evidence/m21`.

| Check                                                                                                                                     | Result                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Private drafts cannot be read, edited or listed across Brand workspaces, by Creators, Agencies or anonymous callers                       | Pass (SQL, stack 404)                        |
| Writes need a Brand owner/admin with MFA                                                                                                  | Pass (SQL)                                   |
| Approval is for a version; edits after approval return the item to review; stale editors are refused                                      | Pass (SQL, concurrency test)                 |
| Unapproved claims need a written reason to approve                                                                                        | Pass (SQL, stack)                            |
| Publication needs the approved version, a complete checklist, an https link and a real date                                               | Pass (SQL, stack)                            |
| Repurposing checks the agreed rights (channels and period) and re-checks them at publication                                              | Pass (SQL)                                   |
| Manual workflows function without social APIs or AI providers                                                                             | Pass (stack: the whole journey is manual)    |
| No fictional publication or performance results: results need a published post, a source and a date; repeated readings replace, never add | Pass (SQL, stack)                            |
| The assistant's content ideas need approval and arrive as ideas, never approved or published                                              | Pass (SQL, stack)                            |
| Accessibility (axe, WCAG A/AA) and no horizontal overflow at 320/768/1280 on all seven screens                                            | Pass (stack)                                 |
| Reuse screen with real Creator deliverables in the browser                                                                                | Not covered by a stack test (covered in SQL) |
