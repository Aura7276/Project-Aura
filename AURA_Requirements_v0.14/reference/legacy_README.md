# Historical reference — superseded where conflicting

Do not execute as current instructions. V0.14 approved module documents take precedence. This is retained for traceability, not implementation evidence.

# Project AURA — Production SaaS Codex Build Kit
Temporary brand only. This package **replaces** the earlier prototype ZIP. It specifies a real, persistent, multi-tenant application. Meta/Instagram API and payment processing are explicitly deferred, not faked.

## Quick start
1. Extract this archive into a **new empty folder**, e.g. `C:\Projects\aura-platform`.
2. Open the folder as a Codex workspace. Ensure `AGENTS.md` is at repository root.
3. Read `docs/DECISIONS_AND_PREREQUISITES.md`, select your real Supabase project, email provider, object storage and hosting. Never paste secrets into Codex prompts or commit `.env` files.
4. In Codex, run `prompts/00-AUDIT-AND-PLAN.md`, then sequentially 01 through 09. Each stage has acceptance criteria and requires tests before proceeding.
5. Use `docs/LOCAL_SETUP.md` for local commands. Codex must verify installed tools and actual provider SDK documentation before implementing integrations.
6. Production launch requires DNS, credentials, configured email delivery, monitoring, legal/privacy review and manual end-to-end verification.

## Principle
No fake dashboards, seeded customer data, pretend login, pretend payment, pretend Instagram connection, or simulated notifications in production. Empty states are legitimate. Test fixtures only in isolated test environments.

## Documentation map
- Product: `PRODUCT_REQUIREMENTS.md`, `USER_JOURNEYS.md`, `SCREEN_INVENTORY.md`
- Design: `DESIGN_SYSTEM.md`
- Engineering: `ARCHITECTURE.md`, `DATA_MODEL.md`, `API_AND_PERMISSIONS.md`
- Security/quality: `SECURITY_AND_PRIVACY.md`, `TEST_AND_ACCEPTANCE.md`
- Environment: `LOCAL_SETUP.md`, `DECISIONS_AND_PREREQUISITES.md`, `SKILLS.md`, `DEPLOYMENT.md`
- SQL reference: `database/REFERENCE_SCHEMA.sql` (design reference; use versioned migrations)
