import { expect, request, test } from "@playwright/test";
import {
  API_BASE_URL,
  FULL_FLOW_ENABLED,
  assertApiIsAvailable,
} from "./helpers/web-e2e-api";

test.describe("protected public routes", () => {
  test("guest user is redirected away from protected marketplace pages", async ({ page }) => {
    test.skip(
      !FULL_FLOW_ENABLED,
      "Set WEB_E2E_FULL_FLOW=1 and run the API + web app before this full-flow E2E.",
    );
    test.setTimeout(45_000);

    const api = await request.newContext({
      baseURL: API_BASE_URL,
      extraHTTPHeaders: {
        "content-type": "application/json",
      },
    });

    try {
      await assertApiIsAvailable(api);

      for (const protectedPath of ["/favorites", "/my-listings"] as const) {
        await page.goto(protectedPath, { waitUntil: "domcontentloaded" });

        await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
        await expect(page.locator(".market-login-button")).toBeVisible({ timeout: 15_000 });
        await expect(page.locator(".market-account-trigger")).toHaveCount(0);
      }
    } finally {
      await api.dispose();
    }
  });
});
