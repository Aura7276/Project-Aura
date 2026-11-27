# Brand AI Growth Assistant architecture (M20)

Request flow, following the approved AI procedure in `09_AI_AND_INTEGRATIONS.md`:

1. **Authorize**: every public function calls `aura_market.brand(workspace, write)`, so only a Brand owner or admin works with it, and writes need MFA.
2. **Minimal context**: `aura_brand_ai_context` assembles facts in the database from the caller's workspace only and from the ticked sources (`aura_brand_ai.context_pref`). A campaign is added only when the conversation is about it. For "explain results" it adds the M19 roll-up with a rule against invented numbers. The page shows the exact JSON before anything is sent.
3. **Allowance**: if a provider is configured, `aura_brand_ai_reserve` takes an advisory lock per workspace and counts the request against the monthly allowance before the provider call.
4. **Bounded provider request** (`src/server/ai/provider.ts`): the same settings and chat-completions shape as M07. It is HTTPS only, refuses redirects, has a 30-second timeout and caps tokens. The system prompt tells the model to treat facts as data, never invent numbers and never claim to act.
5. **Validated output**: the JSON is checked with zod (text, up to 12 items, assumptions, gaps). Anything else is treated as plain text or rejected.
6. **Evidence and drafts**: each turn stores the sources used, the assumptions and the gaps. The answer becomes a draft (`aura_brand_ai.draft`) labelled "AI suggestion".
7. **Approval**: `aura_brand_ai_apply` requires `confirm = true`, locks the draft and re-checks the actor. It only writes M14 plan steps or the campaign's draft brief through `aura_market_save_campaign`; publishing stays gated in M10.

Offline or failing provider: the question and a status turn are saved, no allowance is used while offline, and manual drafts follow the same approval.

Storage: the private schema `aura_brand_ai` has RLS on, no policies and no grants. Public functions are SECURITY DEFINER with `search_path=''`, executable only by `authenticated`.

Routes: `/brand/assistant`, `/brand/assistant/[id]` and `/brand/assistant/settings`. The slug `assistant` is reserved for public Brand pages.
