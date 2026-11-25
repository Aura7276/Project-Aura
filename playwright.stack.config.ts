// End-to-end tests of the REAL application (real routes, layouts and server actions) against the LOCAL TEST STACK
// (scripts/stack): real PostgreSQL migrations behind a stand-in for Supabase Auth and the RPC endpoint. This is NOT Supabase.
import { defineConfig } from "@playwright/test";
const app = "http://127.0.0.1:3103";
const stack = "http://127.0.0.1:54331";
const env = {
  NEXT_PUBLIC_SUPABASE_URL: stack,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_localStackTestKey",
  AURA_SITE_URL: app,
};
export default defineConfig({
  testDir: "tests/stack",
  workers: 1,
  timeout: 60000,
  expect: { timeout: 10000 },
  use: {
    baseURL: app,
    trace: "off",
    ...(process.env.PW_CHROMIUM_PATH
      ? {
          launchOptions: {
            executablePath: process.env.PW_CHROMIUM_PATH,
            args: ["--no-sandbox"],
          },
        }
      : {}),
  },
  webServer: [
    {
      command: "node scripts/stack/fake-supabase.mjs",
      url: `${stack}/health`,
      reuseExistingServer: false,
      timeout: 60000,
      env: { ...process.env } as Record<string, string>,
    },
    {
      command: "pnpm build && pnpm start --port 3103",
      url: app,
      reuseExistingServer: false,
      timeout: 240000,
      env: { ...process.env, ...env } as Record<string, string>,
    },
  ],
  projects: [{ name: "stack", testMatch: /.*\.spec\.ts/ }],
});
