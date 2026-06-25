import { expect, test } from "@playwright/test";

test("browse page opens", async ({ page }) => {
  await page.goto("/browse?sort=newest");

  await expect(page).toHaveTitle(/BabyLoop/i);
  await expect(page.getByRole("main")).toBeVisible();
});
