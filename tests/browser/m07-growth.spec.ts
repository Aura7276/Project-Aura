import { test, expect } from "@playwright/test";
test("Creator can draft, review and approve an illustrative idea", async ({
  page,
}) => {
  await page.goto("/dev/growth-studio");
  await expect(
    page.getByRole("button", { name: "Generate suggestion" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Build a weekly posting routine" })
    .click();
  await page.getByLabel("Time horizon").selectOption("30");
  await page.getByLabel("Working draft").fill("Record a studio diary.");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page
    .getByRole("button", { name: "Draft library", exact: true })
    .click();
  await page.getByRole("button", { name: /Plan Build a weekly/ }).click();
  await expect(page.getByLabel("Time horizon")).toHaveValue("30");
  await page.getByRole("button", { name: "Review idea" }).click();
  await page.getByRole("button", { name: "Approve and add idea" }).click();
  await expect(page.getByRole("status")).toContainText(
    "No workspace record created",
  );
  await expect(page.getByLabel("Working draft")).toBeDisabled();
});
test("Preview memory deletion requires confirmation", async ({ page }) => {
  await page.goto("/dev/growth-studio");
  await page.getByRole("button", { name: "Memory", exact: true }).click();
  await page.getByLabel("Style and preferences").fill("Short scripts");
  await page
    .getByRole("button", { name: "Request deletion", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm deletion request" }).click();
  await expect(page.getByLabel("Style and preferences")).toHaveValue("");
});
