# System architecture

One Next.js App Router deployable owns rendering, request boundaries and future feature services. The landing route exposes a foundation identifier. The local development catalog exercises UI state only. Its server page uses a development guard and the request proxy returns HTTP 404 for production /dev/ paths. Local fonts keep builds independent of a font CDN.

Routes compose shared primitives and future feature entry points. Feature code calls server services for operations. Server services verify identity, check contextual permissions, validate input and call a request-bound database client. Browser calls using the publishable key are subject to PostgreSQL and Storage policies. Introduce protected server rendering and session renewal with M02. No background workers or remote APIs are required to render the foundation.

| Path                                                 | Responsibility                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------------- |
| src/app                                              | Root layout, minimal entry, development catalog                           |
| src/components/ui, src/lib/utils.ts                  | Shared shadcn components, feedback and class merging                      |
| src/features, src/types                              | Future module boundaries and shared contracts                             |
| src/config, src/validation                           | Environment parsing and input schemas                                     |
| src/server                                           | Server-only identity gate, database access and structured security events |
| src/lib/supabase                                     | Browser client factory for Auth, PostgreSQL Data API and Storage          |
| src/proxy.ts                                         | Per-request content policy and defensive headers                          |
| supabase/migrations                                  | Immutable ordered schema changes                                          |
| tests/unit, tests/browser                            | Unit, interaction, accessibility and production smoke cases               |
| public                                               | Static assets                                                             |
| AURA_Requirements_v0.14                              | Original requirements package                                             |
| docs/architecture, docs/development, docs/acceptance | Architecture, evidence, decisions and manual acceptance                   |
