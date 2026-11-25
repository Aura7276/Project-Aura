import { defineConfig } from "@playwright/test";
const dev = "http://127.0.0.1:3101";
const prod = "http://127.0.0.1:3102";
export default defineConfig({
  testDir: "tests/browser",
  workers: 2,
  use: {
    baseURL: dev,
    trace: "retain-on-failure",
    // Optional: point at a pre-installed Chromium when the pinned Playwright build is unavailable.
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
      command: "pnpm dev --port 3101",
      url: dev,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      command: "pnpm start --port 3102",
      url: prod,
      reuseExistingServer: false,
      timeout: 60000,
    },
  ],
  projects: [
    { name: "chromium", testIgnore: /production/ },
    { name: "production", testMatch: /production/, use: { baseURL: prod } },
  ],
});
