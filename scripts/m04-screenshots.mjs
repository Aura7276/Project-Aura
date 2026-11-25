// Captures M04 development-preview screenshots (illustrative data only; nothing here is a real Creator).
// Usage: PW_CHROMIUM_PATH=/path/to/chrome node scripts/m04-screenshots.mjs  (dev server on 127.0.0.1:3101)
import { chromium } from "@playwright/test";
const base = process.env.BASE_URL ?? "http://127.0.0.1:3101";
const out = "docs/development/evidence/m04";
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH,
  args: ["--no-sandbox"],
});
const views = [
  ["mobile", 390, 844],
  ["tablet", 768, 1024],
  ["desktop", 1440, 900],
];
const pages = [
  ["dashboard", "aspiring"],
  ["dashboard", "below100"],
  ["dashboard", "qualifying"],
  ["actions", "aspiring"],
  ["progress", "below100"],
  ["recommendations", "below100"],
  ["create", "aspiring"],
];
for (const [name, width, height] of views) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  for (const [p, s] of pages) {
    await page.goto(`${base}/dev/studio-preview/${p}?situation=${s}`);
    await page.waitForTimeout(250);
    await page.screenshot({
      path: `${out}/${p}-${s}-${name}.png`,
      fullPage: true,
    });
  }
  if (name === "mobile") {
    await page.goto(`${base}/dev/studio-preview/dashboard?situation=below100`);
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${out}/drawer-mobile.png` });
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Quick create" }).click();
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${out}/quick-create-mobile.png` });
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Open Growth Assistant" }).click();
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${out}/assistant-mobile.png` });
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Start tour" }).click();
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${out}/walkthrough-mobile.png` });
  }
  await context.close();
}
await browser.close();
console.log("done");
