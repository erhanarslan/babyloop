import { expect, request, test, type Page } from "@playwright/test";
import {
  API_BASE_URL,
  FULL_FLOW_ENABLED,
  assertApiIsAvailable,
  createVerifiedUser
} from "./helpers/web-e2e-api";

const SCROLL_TOLERANCE_PX = 2;

test.describe("overlay scroll preservation", () => {
  test("keeps the listing viewport while auth modal opens and closes", async ({ page }) => {
    let listingRequestCount = 0;
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/v1/listings") listingRequestCount += 1;
    });
    await page.goto("/browse?sort=newest", { waitUntil: "domcontentloaded" });
    await dismissCookieConsent(page);
    const before = await scrollIntoListingContent(page);
    const requestsBeforeOverlay = listingRequestCount;

    await page.locator(".market-login-button").click();
    await expect(page.getByRole("dialog").filter({ has: page.locator('input[name="email"]') })).toBeVisible();
    await expectScrollNear(page, before);

    await page.keyboard.press("Escape");
    await expect(page.locator(".market-auth-modal-card")).toHaveCount(0);
    await expectScrollNear(page, before);

    await page.locator(".market-login-button").click();
    await page.locator(".market-modal-backdrop").click({ position: { x: 4, y: 4 } });
    await expect(page.locator(".market-auth-modal-card")).toHaveCount(0);
    await expectScrollNear(page, before);
    expect(new URL(page.url()).searchParams.get("sort")).toBe("newest");
    expect(listingRequestCount).toBe(requestsBeforeOverlay);
  });

  test("keeps mobile scroll while the navigation drawer opens and closes", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/browse?sort=newest", { waitUntil: "domcontentloaded" });
    await dismissCookieConsent(page);
    const before = await scrollIntoListingContent(page);

    await page.locator(".market-mobile-menu-button").click();
    await expect(page.locator("#mobile-market-navigation")).toHaveAttribute("aria-modal", "true");
    await expectScrollNear(page, before);
    await page.keyboard.press("Escape");
    await expect(page.locator("#mobile-market-navigation")).toHaveAttribute("aria-hidden", "true");
    await expectScrollNear(page, before);
  });

  test("keeps the listing viewport while an authenticated account menu toggles", async ({ page }) => {
    test.skip(!FULL_FLOW_ENABLED, "Full-flow account-menu scroll coverage requires the local API.");
    test.setTimeout(60_000);
    const api = await request.newContext({
      baseURL: API_BASE_URL,
      extraHTTPHeaders: { "content-type": "application/json" }
    });

    try {
      await assertApiIsAvailable(api);
      const displayName = "Scroll E2E User";
      const email = `scroll-e2e-${Date.now()}@babyloop.test`;
      const password = "Password12345!";
      await createVerifiedUser(api, { displayName, email, locationCity: "İstanbul", password });

      await page.goto("/browse?sort=newest&auth=login", { waitUntil: "domcontentloaded" });
      await dismissCookieConsent(page);
      const loginForm = page.locator('form:has(input[name="email"]):has(input[name="password"])');
      await loginForm.locator('input[name="email"]').fill(email);
      await loginForm.locator('input[name="password"]').fill(password);
      await loginForm.getByRole("button", { name: "Giriş yap" }).click();

      const accountTrigger = page.locator(".market-account-trigger").filter({ hasText: displayName });
      await expect(accountTrigger).toBeVisible({ timeout: 15_000 });
      const before = await scrollIntoListingContent(page);
      await accountTrigger.click();
      await expect(page.locator(".market-account-menu")).toBeVisible();
      await expectScrollNear(page, before);
      await accountTrigger.click();
      await expect(page.locator(".market-account-menu")).toHaveCount(0);
      await expectScrollNear(page, before);
    } finally {
      await api.dispose();
    }
  });
});

async function scrollIntoListingContent(page: Page): Promise<number> {
  const target = await page.evaluate(() => {
    const maximum = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const top = Math.min(1500, maximum);
    window.scrollTo({ top, behavior: "instant" });
    return window.scrollY;
  });
  expect(target).toBeGreaterThan(200);
  return target;
}

async function expectScrollNear(page: Page, expected: number): Promise<void> {
  await expect.poll(async () => {
    const actual = await page.evaluate(() => window.scrollY);
    return Math.abs(actual - expected);
  }).toBeLessThanOrEqual(SCROLL_TOLERANCE_PX);
}

async function dismissCookieConsent(page: Page): Promise<void> {
  const consent = page.getByRole("dialog", { name: "Çerez ve analitik tercihleri" });
  if (await consent.isVisible()) {
    await consent.getByRole("button", { name: "İsteğe bağlıları reddet", exact: true }).click();
  }
}
