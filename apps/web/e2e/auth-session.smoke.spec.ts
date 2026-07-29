import { expect, request, test } from "@playwright/test";
import {
  API_BASE_URL,
  FULL_FLOW_ENABLED,
  assertApiIsAvailable,
  createVerifiedUser,
  safeResponseText,
} from "./helpers/web-e2e-api";

test.describe("auth session flow", () => {
  test("user can login from UI and logout from account menu", async ({ page }) => {
    test.skip(
      !FULL_FLOW_ENABLED,
      "Set WEB_E2E_FULL_FLOW=1 and run the API + web app before this full-flow E2E.",
    );
    test.setTimeout(60_000);

    const api = await request.newContext({
      baseURL: API_BASE_URL,
      extraHTTPHeaders: {
        "content-type": "application/json",
      },
    });

    try {
      await assertApiIsAvailable(api);
      const displayName = "Web E2E Auth User";
      const email = `web-e2e-auth-${Date.now()}@babyloop.test`;
      const password = "Password12345!";

      await createVerifiedUser(api, {
        displayName,
        email,
        locationCity: "İstanbul",
        password,
      });

      await page.goto("/", { waitUntil: "domcontentloaded" });

      const cookieConsent = page.getByRole("dialog", { name: "Çerez ve analitik tercihleri" });

      if (await cookieConsent.isVisible()) {
        await cookieConsent.getByRole("button", { name: "İsteğe bağlıları reddet", exact: true }).click();
        await expect(cookieConsent).toHaveCount(0);
      }

      const loginPageResponse = await page.goto("/?auth=login", { waitUntil: "domcontentloaded" });

      expect(loginPageResponse).not.toBeNull();
      expect(new URL(loginPageResponse!.url()).searchParams.get("auth")).toBe("login");

      const loginForm = page.locator('form:has(input[name="email"]):has(input[name="password"])');
      await expect(loginForm).toHaveCount(1);
      await expect(loginForm).toBeVisible();

      await loginForm.locator('input[name="email"]').fill(email);
      await loginForm.locator('input[name="password"]').fill(password);

      const loginResponsePromise = page.waitForResponse((response) => {
        return response.url().includes("/api/v1/auth/login") && response.request().method() === "POST";
      });

      await loginForm.getByRole("button", { name: "Giriş yap" }).click();

      const loginResponse = await loginResponsePromise;
      expect(loginResponse.ok(), await safeResponseText(loginResponse)).toBe(true);

      const accountTrigger = () => page.locator(".market-account-trigger").filter({ hasText: displayName });
      await expect(accountTrigger()).toBeVisible({ timeout: 15_000 });

      if (await cookieConsent.isVisible()) {
        await cookieConsent.getByRole("button", { name: "İsteğe bağlıları reddet", exact: true }).click();
        await expect(cookieConsent).toHaveCount(0);
      }

      await accountTrigger().click();

      const accountMenu = page.locator(".market-account-menu");
      await expect(accountMenu).toBeVisible();

      await accountMenu.getByRole("button", { name: "Çıkış yap" }).click();

      await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
      await expect(page.locator(".market-login-button")).toBeVisible({ timeout: 15_000 });
      await expect(page.locator(".market-account-trigger")).toHaveCount(0);
    } finally {
      await api.dispose();
    }
  });
});
