// Captures M03 preview screenshots (development preview data only; nothing here is a real Creator).
// Usage: PW_CHROMIUM_PATH=/path/to/chrome node scripts/m03-screenshots.mjs  (dev server on 127.0.0.1:3101)
import { chromium } from "@playwright/test";
const base = process.env.BASE_URL ?? "http://127.0.0.1:3101";
const out = "docs/development/evidence/m03";
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH,
  args: ["--no-sandbox"],
});
const shots = [
  ["identity"],
  [
    "social",
    async (p) => {
      await p.getByRole("button", { name: "Add an account" }).click();
    },
  ],
  ["niche"],
  [
    "goals",
    async (p) => {
      await p.getByLabel("Audience growth").check();
    },
  ],
  ["preferences"],
  ["summary"],
];
for (const [name, width, height] of [
  ["mobile", 390, 844],
  ["desktop", 1440, 900],
]) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  for (const [step, prep] of shots) {
    await page.goto(`${base}/dev/onboarding-preview/${step}`);
    if (prep) await prep(page);
    await page.screenshot({
      path: `${out}/${step}-${name}.png`,
      fullPage: true,
    });
  }
  await context.close();
}
await browser.close();
console.log("done");
