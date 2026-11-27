# M20 complete report: Brand AI Growth Assistant

Branch `feature/m20-brand-ai`, built on `main` (M01–M19). Built from the reconstructed module file, so M20-F numbers are not assigned. **No AI provider is selected or configured**: the assistant ships in offline mode, and no real AI output has been produced or tested.

## Delivered

- **Migration** `20261212000100_m20_brand_ai.sql`: schema `aura_brand_ai` with 7 tables:
  - settings
  - conversations
  - turns
  - drafts
  - opt-in memory
  - context sources
  - monthly usage

  It adds 12 public functions. A separate migration, `20261212000200_reserve_brand_assistant_route.sql`, reserves the `assistant` slug.

- **Assistant home** (`/brand/assistant`, "Assistant" in the Brand navigation):
  - honest provider status
  - start a conversation for one of six tasks
  - monthly usage meter
  - shared sources
  - drafts waiting for review
  - conversation history
- **Conversation**:
  - messages, with AI answers labelled "AI suggestion" and showing sources, assumptions and missing information
  - a "What will be shared" panel with the exact facts
  - a plan length for plan tasks
  - drafts with approve (explicit tick) or discard
  - "Write a draft yourself", which uses the same approval
  - delete conversation
- **Approval outcomes**:
  - Plan steps join the M14 plan as the Brand's own edits.
  - A brief goes to the campaign's draft only; the live campaign changes when the Brand publishes.
  - Invitation messages and strategy notes are marked ready; nothing is sent.
- **Settings**: choose shared sources (budget, Creator preferences and competitors are opt-in), turn memory and team preferences on or off (off by default), delete memory, and see the allowance.
- **Provider adapter** (`src/server/ai/provider.ts`): the M07 settings and request shape, HTTPS only, no redirects, 30-second timeout, validated JSON answers.

## Verification

Local PostgreSQL 16 with auth and storage stubs (not live Supabase). These pass: Prettier, typecheck, ESLint (0 errors, 1 existing warning), Vitest (30 files, 338 tests), the browser suite (137 tests), the stack suite (40 tests), the production build, and `pnpm audit --prod` (no known vulnerabilities). The M14 route-reservation test first failed because it does not load M20. The reservation moved to its own migration, which that test now loads, and the M14 and M20 database tests were re-run and pass. M20 adds:

- 5 SQL scenario groups.
- Database tests: the M19, M18 and M11 suites re-run, RLS, grant and search_path checks, defaults, and an allowance race where 6 parallel requests against an allowance of 3 give exactly 3.
- 12 unit tests for the adapter (mocked network), parsing and task rules.
- A stack test for offline mode, the shared-context panel, manual drafts with approval into the plan, discard, memory on and delete, isolation from another Brand, delete conversation, accessibility and overflow at 320/768/1280.

## Owner decisions needed

- AI provider, model and data-processing agreement.
- Allowance of 100 requests per month.
- Memory off by default.
- Default sources (see the decision register).

## Not built

- The original requirements that were not recovered.
- Any real AI output.
- Sending invitations from the assistant (by design).
- M21/M22 sources.
- Per-plan allowances.
- Streaming answers.
