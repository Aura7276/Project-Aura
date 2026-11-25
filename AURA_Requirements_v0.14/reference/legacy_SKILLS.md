# Historical reference — superseded where conflicting

Do not execute as current instructions. V0.14 approved module documents take precedence. This is retained for traceability, not implementation evidence.

# Codex skills — installation guidance
No skills have been verified as installed in your local Codex. Skill availability varies by environment; do not assume named skills exist.

## Recommended capabilities
- Browser automation and E2E: Playwright; install/test via project dependencies even if no Codex skill exists.
- Frontend design and UI review: use any trusted official frontend design skill available in your Codex catalog; otherwise follow `DESIGN_SYSTEM.md`.
- Security review: official/trusted security-best-practices skill if available; otherwise use `SECURITY_AND_PRIVACY.md` and automated scanners.
- Supabase: current official Supabase documentation and CLI; avoid unreviewed community skills with database credentials.
- Deployment: provider's official docs/CLI.

## Verify before installing
In Codex, inspect available skills via its supported skill UI or `$skill-installer` if that command exists in your version. Check publisher, repository, permissions and instructions. Skill names previously mentioned (e.g. frontend-app-builder) are not guaranteed to exist or be installable. No special skill is required to start the project.

## Minimum tools
Node.js LTS, pnpm, Git, Supabase CLI, Playwright, TypeScript, ESLint, Vitest, Docker if local DB. Never grant unknown third-party skills production secrets.
