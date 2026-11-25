// Starts the LOCAL TEST STACK (NOT Supabase) and the app together for manual testing.
// Needs PostgreSQL 15+ with `psql` on PATH and a role that can create databases (set PGHOST, PGPORT, PGUSER as needed).
import { spawn } from "node:child_process";
import { setupDatabase, start } from "./fake-supabase.mjs";

const app = "http://127.0.0.1:3103",
  stack = "http://127.0.0.1:54331";
setupDatabase();
await start();
const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: stack,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_localStackTestKey",
  AURA_SITE_URL: app,
};
const next = spawn("pnpm", ["dev", "--port", "3103"], {
  env,
  stdio: "inherit",
});
next.on("exit", (c) => process.exit(c ?? 0));
process.on("SIGINT", () => next.kill("SIGINT"));
console.log(`
Local test stack running (NOT Supabase: sign-up, passwords and email do not exist here).
Open one of these to sign in as a test user and land in the real app:
  New Creator, onboarding not started:  ${stack}/__test/login?email=demo@example.test&to=/onboarding/creator
  Any other user (created on first use): ${stack}/__test/login?email=YOUR-NAME@example.test&to=/onboarding/creator
  After you activate, go to:             ${stack}/__test/login?email=demo@example.test&to=/creator/dashboard
Public site (M01): ${app}/
`);
