# M07 Growth Studio

The signed-in Creator workbench is at `/creator/ai`. For manual review run `pnpm dev --port 3101` and open [the development preview](http://127.0.0.1:3101/dev/growth-studio). Choose a starter brief, change the plan horizon, write a draft, reopen it from Draft library, and review the idea before approving it. The development preview keeps illustrative work in page memory.

The hosted workflow requires the reviewed M07 migration, an authenticated active Creator workspace, an authorized allowance policy and a provider configured through AURA_AI_ENDPOINT, AURA_AI_API_KEY and AURA_AI_MODEL. Confirm provider retention and training terms before enabling private coaching. Verify pg_cron configuration before accepting scheduled check-ins. No hosted migration or provider call was verified in this stage.

Local validation covered the production build, strict type checking, draft approval, memory controls and PostgreSQL access boundaries. The requirements matrix records remaining work for each of the 32 functional requirements. Owner acceptance remains pending.
