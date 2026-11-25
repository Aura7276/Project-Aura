# Historical reference — superseded where conflicting

Do not execute as current instructions. V0.14 approved module documents take precedence. This is retained for traceability, not implementation evidence.

# Codex operating contract — Project AURA
Read all files in `docs/` before implementation. The current production package supersedes any previous AURA prototype specifications. Brand name is a replaceable configuration value.

## Non-negotiable
- Build a functioning, persisted, multi-tenant SaaS product, NOT a clickable mockup. No fake metrics, fake users, mock production auth, pretend verification, simulated emails, fake successful uploads, payment receipts or Meta connections. No dummy brand endorsements.
- Meta API/OAuth/insights and payment gateway/escrow/automated payment verification are **OUT OF SCOPE**. No Instagram OAuth or analytics charts until integrated. Manual Instagram handles are unverified and clearly labelled. No payment status assertions without verified evidence. Allow offline commercial terms and external settlement, but do not claim settlement verified.
- Real email/password auth, email verification, password reset, secure sessions and backend-enforced RBAC. All workspace queries MUST be scoped and authorized server-side. Never trust a client-provided workspace ID by itself.
- Creator profiles PRIVATE by default; publish only via deliberate, audited action. Brand verification is REVIEWED, not automatically granted on submission. Agency access to a client requires explicit relationship and scoped permission.
- Use PostgreSQL and versioned migrations. All durable business state lives in database/object storage; localStorage only for non-sensitive UI preferences. Never use browser storage as source of truth for auth or business state.
- Implement every button, link, form and action in the declared release scope end-to-end. Otherwise remove or visibly mark as unavailable, with no misleading affordance.
- Design: Creative Premium / Editorial + Product; use tokens from `docs/DESIGN_SYSTEM.md`. Mobile-first creator; desktop-efficient brand/admin; accessible and reduced-motion compatible.
- Validation on client and server; server is authoritative. CSRF-safe session handling, authorization, safe file uploads, pagination, rate limits, structured audit events and safe error handling.
- Never log secrets, auth tokens, email verification tokens, personal data payloads, or unredacted uploaded files. No service-role credentials in browser bundles. RLS policies if using Supabase and server authorization in all cases.
- No production data seeding. Automated tests may create fixtures in disposable test database only.

## Work method
1. Inspect repository and documentation, identify blockers and assumptions. Do not silently invent business rules.
2. Implement one stage at a time; produce migration + backend + frontend + tests together.
3. Run typecheck, lint, tests, migration validation, production build and relevant Playwright tests; fix failures before claiming done.
4. At end of each stage report: changed files, commands run, passing/failing tests, environment prerequisites, known limitations, and next stage.
5. Do not claim provider configuration, email delivery, DNS, or production deployment succeeded unless actually verified.
6. When environment lacks access or credentials, implement integration with typed adapter and explicit blocked state; never fabricate success.
7. Keep `docs/IMPLEMENTATION_STATUS.md` updated with verified completed and blocked items.
