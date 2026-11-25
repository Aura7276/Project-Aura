# AURA development instructions

The original AURA_Requirements_v0.14 directory is the approved requirements baseline. Preserve its files. Read README.md, 02_MASTER_PRD.md, 03_FUNCTIONAL_REQUIREMENTS.md, 07_BUSINESS_RULES.md, 11_SECURITY_AND_PRIVACY.md, 14_DEVELOPMENT_PLAN.md, 15_REQUIREMENTS_TRACEABILITY.md and the relevant modules/ specification before edits. The reference/ directory is historical. Latest explicit approvals govern conflicts. Screens, entities and test designs in the handover are proposals.

Phase 00 established the foundation. Follow the current development status and latest explicit owner authorization for M01 and later work. Deliver subsequent modules sequentially against their F IDs. Record decisions, dependencies, test evidence and human acceptance under docs/. Ask for unresolved business policy. Never invent users, credentials, commercial records, authentication, backend results or test passes. Isolate fixtures to tests and development previews.

Keep the modular monolith, strict TypeScript, pnpm lockfile, server-only services and independent tenant authorization. Validate inputs; scope all tenant operations, RLS and storage access. Keep customer data and secrets out of logs, Git and client bundles. Preserve private defaults and require explicit business authorization for sharing. Review migrations, backup and test before release. Destructive production operations require separate approval.

Run frozen installation, formatting, lint, typecheck, Vitest, build, Playwright and audit. Record blockers and actual execution counts. Never include skipped tests among passes. Use the status vocabulary in docs/development/DEVELOPMENT_STATUS.md.

## Visual assets from M01.03 through M14

Preserve approved assets. Use reusable accessible CSS, SVG, Lucide and typography placeholders with reserved responsive geometry, neutral avatars and functional interface previews. Label illustrative records. Defer decorative sourcing, image generation, stock acquisition and external image URLs to separate visual refinement. Record each slot, page, description, dimensions, aspect ratio, placeholder and replacement status in docs/development/ASSET_PROVENANCE.md.

## Collaborative delivery

Follow docs/development/AGENT_HANDOVER.md for the current approved stage. Use one feature branch per task and separate worktrees for concurrent agents. Coordinate ownership before editing shared files. After the initial upload, all AI-authored changes go through a task branch and owner-reviewed pull request. Only merge after owner review. Inspect current code and approved requirements first. Preserve the existing application and architecture, avoid duplicate scaffolding, and obtain owner authorization for requirement changes or future modules. Update requirements traceability after each stage, run applicable regressions and report evidence before submission.
