import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
const phase = process.argv[2];
if (!["before", "after"].includes(phase))
  throw Error("Expected before or after");
const dest = "docs/development/evidence/design-refinement/" + phase;
fs.mkdirSync(dest, { recursive: true });
const routes = new Set(
  fs
    .readdirSync("src/app", { recursive: true })
    .map(String)
    .filter((f) => /page\.tsx$/.test(f))
    .map(
      (f) =>
        "/" +
        f
          .replaceAll("\\", "/")
          .split("/")
          .filter((s) => !s.startsWith("(") && s !== "page.tsx")
          .join("/"),
    )
    .map((s) =>
      s
        .replace("[page]", "dashboard")
        .replace("[step]", "goals")
        .replace(
          "[slug]",
          s.startsWith("/resources") ? "build-your-media-kit" : "audit-fixture",
        )
        .replace(/\[.*?\]/g, "audit-fixture"),
    ),
);
const browser = await chromium.launch();
const queue = [...routes];
const records = [];
await Promise.all(
  Array.from({ length: 3 }, async () => {
    for (let route; (route = queue.shift());) {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 930 },
        reducedMotion: "reduce",
      });
      try {
        const response = await page.goto("http://127.0.0.1:3101" + route, {
          timeout: 60000,
        });
        if (
          /^\/(account|admin|workspaces|security|mfa|identity|onboarding|creator)(?:\/|$)/.test(
            route,
          ) &&
          route !== "/creator/audit-fixture"
        )
          await page.waitForURL(/\/login(?:\?|$)/);
        await page.evaluate(() => document.fonts.ready);
        const file = (route.slice(1) || "home").replaceAll("/", "-");
        await page.screenshot({
          path: path.join(dest, file + ".jpg"),
          quality: 56,
        });
        records.push({
          route,
          landed: new URL(page.url()).pathname,
          status: response?.status(),
          heading: await page
            .locator("h1")
            .first()
            .textContent({ timeout: 1000 })
            .catch(() => null),
        });
      } catch (e) {
        records.push({ route, error: e.message.slice(0, 100) });
      }
      await page.close();
    }
  }),
);
await browser.close();
fs.writeFileSync(
  path.join(dest, "routes.json"),
  JSON.stringify(
    records.sort((a, b) => a.route.localeCompare(b.route)),
    null,
    2,
  ) + "\n",
);
