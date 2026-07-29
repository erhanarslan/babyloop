import { expect, request, test, type Locator, type Page } from "@playwright/test";
import {
  API_BASE_URL,
  E2E_PASSWORD,
  FULL_FLOW_ENABLED,
  assertApiIsAvailable,
  createListing,
  createVerifiedUser,
  expectMyListingStatus,
  fetchFirstCategoryId,
  installAuthRefreshRoute,
  updateListingStatus,
} from "./helpers/web-e2e-api";

const RAW_INTERNAL_TOKEN_SENTINEL = "accessToken";
const RAW_REFRESH_TOKEN_SENTINEL = "refreshToken";
const RAW_PHONE_SENTINEL = "+905551112233";
const RAW_BUYER_EMAIL_SENTINEL = "buyer-private-my-listings@babyloop.test";

test.describe("my listings flow", () => {
  test("seller can manage listing status lifecycle from listing management", async ({ page }) => {
    test.skip(
      !FULL_FLOW_ENABLED,
      "Set WEB_E2E_FULL_FLOW=1 and run the API + web app before this full-flow E2E.",
    );
    test.setTimeout(90_000);

    const setupApi = await request.newContext({
      baseURL: API_BASE_URL,
      extraHTTPHeaders: {
        "content-type": "application/json",
      },
    });
    const sellerApi = await request.newContext({
      baseURL: API_BASE_URL,
      extraHTTPHeaders: {
        "content-type": "application/json",
      },
    });

    try {
      await assertApiIsAvailable(setupApi);

      const categoryId = await fetchFirstCategoryId(setupApi);
      const unique = Date.now();
      const sellerEmail = `web-e2e-my-listings-seller-${unique}@babyloop.test`;
      const listingTitle = `Web E2E ilan yönetimi ürünü ${unique}`;

      const seller = await createVerifiedUser(sellerApi, {
        displayName: "Web E2E Listing Owner",
        email: sellerEmail,
        locationCity: "İstanbul",
        password: E2E_PASSWORD,
      });

      const listing = await createListing(sellerApi, {
        accessToken: seller.accessToken,
        categoryId,
        title: listingTitle,
      });

      await installAuthRefreshRoute(page, seller);

      await page.goto("/my-listings", { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/my-listings/, { timeout: 15_000 });
      await expect(page.getByRole("heading", { name: "İlanlarım", exact: true })).toBeVisible({
        timeout: 15_000,
      });

      const listingCard = page.locator(`article[data-listing-id="${listing.id}"]`);

      await expect(listingCard).toBeVisible({ timeout: 15_000 });
      await expect(listingCard).toHaveAttribute("data-listing-status", "active");
      await expect(listingCard.locator('[data-listing-status-label="active"]')).toBeVisible();
      await expect(listingCard).toContainText(listingTitle);
      await expect(listingCard).toContainText("Favori: 0");
      const listingDetailLink = listingCard.locator(`a[href="/listings/${listing.id}"]`).first();
      await expect(listingDetailLink).toBeVisible();
      await expect(listingDetailLink).toHaveAttribute("href", `/listings/${listing.id}`);

      await changeListingStatusFromUi(page, listingCard, 0);
      await expectMyListingStatus(sellerApi, {
        accessToken: seller.accessToken,
        listingId: listing.id,
        status: "reserved",
      });
      await expect(listingCard).toHaveAttribute("data-listing-status", "reserved", {
        timeout: 15_000,
      });
      await expect(listingCard.locator('[data-listing-status-label="reserved"]')).toBeVisible();

      await page.locator('nav[aria-label="İlan durumu"] [data-status-filter="reserved"]').click();
      await expect(listingCard).toBeVisible({ timeout: 15_000 });

      await page.locator('nav[aria-label="İlan durumu"] [data-status-filter="active"]').click();
      await expect(listingCard).toHaveCount(0);
      await expect(page.getByText("Bu durumda ilan yok", { exact: true })).toBeVisible();

      await page.locator('nav[aria-label="İlan durumu"] [data-status-filter="reserved"]').click();
      await expect(listingCard).toBeVisible({ timeout: 15_000 });

      await changeListingStatusFromUi(page, listingCard, 0);
      await expectMyListingStatus(sellerApi, {
        accessToken: seller.accessToken,
        listingId: listing.id,
        status: "active",
      });

      // We are still on the reserved filter, so an active listing should leave this filtered view.
      await expect(listingCard).toHaveCount(0);

      await page.locator('nav[aria-label="İlan durumu"] [data-status-filter="active"]').click();
      await expect(listingCard).toBeVisible({ timeout: 15_000 });
      await expect(listingCard).toHaveAttribute("data-listing-status", "active", {
        timeout: 15_000,
      });

      await page.locator('[data-status-filter="all"]').click();
      await expect(listingCard).toBeVisible({ timeout: 15_000 });

      // Active actions are ordered as reserved, sold, archived. Choosing index 1 marks it sold.
      await changeListingStatusFromUi(page, listingCard, 1);
      await expectMyListingStatus(sellerApi, {
        accessToken: seller.accessToken,
        listingId: listing.id,
        status: "sold",
      });
      await expect(listingCard).toHaveAttribute("data-listing-status", "sold", {
        timeout: 15_000,
      });
      await expect(listingCard.locator('[data-listing-status-label="sold"]')).toBeVisible();
      await expect(listingCard.getByText("Satıldı", { exact: true })).toBeVisible();

      await page.locator('nav[aria-label="İlan durumu"] [data-status-filter="completed"]').click();
      await expect(listingCard).toBeVisible({ timeout: 15_000 });

      await page.locator('nav[aria-label="İlan durumu"] [data-status-filter="active"]').click();
      await expect(listingCard).toHaveCount(0);

      await expectNoMyListingsSensitiveLeak(page, {
        sellerAccessToken: seller.accessToken,
        sellerEmail,
      });
    } finally {
      await setupApi.dispose();
      await sellerApi.dispose();
    }
  });

  test("seller can see externally reserved listing in listing management", async ({ page }) => {
    test.skip(
      !FULL_FLOW_ENABLED,
      "Set WEB_E2E_FULL_FLOW=1 and run the API + web app before this full-flow E2E.",
    );
    test.setTimeout(60_000);

    const setupApi = await request.newContext({
      baseURL: API_BASE_URL,
      extraHTTPHeaders: {
        "content-type": "application/json",
      },
    });
    const sellerApi = await request.newContext({
      baseURL: API_BASE_URL,
      extraHTTPHeaders: {
        "content-type": "application/json",
      },
    });

    try {
      await assertApiIsAvailable(setupApi);

      const categoryId = await fetchFirstCategoryId(setupApi);
      const unique = Date.now();
      const sellerEmail = `web-e2e-my-listings-reserved-seller-${unique}@babyloop.test`;
      const listingTitle = `Web E2E ilan yönetimi rezerve ürünü ${unique}`;

      const seller = await createVerifiedUser(sellerApi, {
        displayName: "Web E2E Listing Owner",
        email: sellerEmail,
        locationCity: "İstanbul",
        password: E2E_PASSWORD,
      });

      const listing = await createListing(sellerApi, {
        accessToken: seller.accessToken,
        categoryId,
        title: listingTitle,
      });

      await updateListingStatus(sellerApi, {
        accessToken: seller.accessToken,
        listingId: listing.id,
        status: "reserved",
      });

      await expectMyListingStatus(sellerApi, {
        accessToken: seller.accessToken,
        listingId: listing.id,
        status: "reserved",
      });

      await installAuthRefreshRoute(page, seller);

      await page.goto("/my-listings", { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/my-listings/, { timeout: 15_000 });

      const listingCard = page.locator(`article[data-listing-id="${listing.id}"]`);

      await expect(listingCard).toBeVisible({ timeout: 15_000 });
      await expect(listingCard).toHaveAttribute("data-listing-status", "reserved");
      await expect(listingCard.locator('[data-listing-status-label="reserved"]')).toBeVisible();

      await page.locator('nav[aria-label="İlan durumu"] [data-status-filter="reserved"]').click();
      await expect(listingCard).toBeVisible({ timeout: 15_000 });

      await page.locator('nav[aria-label="İlan durumu"] [data-status-filter="active"]').click();
      await expect(listingCard).toHaveCount(0);

      await expectNoMyListingsSensitiveLeak(page, {
        sellerAccessToken: seller.accessToken,
        sellerEmail,
      });
    } finally {
      await setupApi.dispose();
      await sellerApi.dispose();
    }
  });
});

async function changeListingStatusFromUi(page: Page, listingCard: Locator, statusActionIndex: number): Promise<void> {
  const listingId = await listingCard.getAttribute("data-listing-id");

  if (!listingId) {
    throw new Error("Listing card is missing data-listing-id.");
  }

  const trigger = listingCard.locator(`[data-listing-status-menu-trigger="${listingId}"]`);

  await expect(trigger).toBeVisible({ timeout: 15_000 });
  await trigger.dispatchEvent("pointerdown", {
    bubbles: true,
    cancelable: true,
    pointerType: "mouse"
  });
  await expect(trigger).toHaveAttribute("aria-expanded", "true", { timeout: 15_000 });

  const menu = listingCard.locator(`[data-listing-status-menu="${listingId}"]`);
  await expect(menu).toBeVisible({ timeout: 15_000 });
  await expect(menu).toHaveAttribute("role", "menu");

  const statusAction = menu.locator('button[role="menuitem"][data-listing-status-action]').nth(statusActionIndex);
  await expect(statusAction).toBeVisible({ timeout: 15_000 });
  await statusAction.scrollIntoViewIfNeeded();
  await expectStatusActionInViewport(page, statusAction);

  const statusResponsePromise = page.waitForResponse((response) => {
    return response.url().includes(`/api/v1/listings/${listingId}/status`) &&
      response.request().method() === "PATCH";
  });

  await statusAction.click();

  const statusResponse = await statusResponsePromise;
  expect(statusResponse.ok(), await statusResponse.text()).toBe(true);
}

async function expectStatusActionInViewport(page: Page, statusAction: Locator): Promise<void> {
  const box = await statusAction.boundingBox();

  if (!box) {
    throw new Error("Status action has no bounding box.");
  }

  const viewport = page.viewportSize();

  if (!viewport) {
    return;
  }

  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
}

async function expectNoMyListingsSensitiveLeak(
  page: Page,
  input: {
    sellerAccessToken: string;
    sellerEmail: string;
  },
): Promise<void> {
  const body = page.locator("body");

  await expect(body).not.toContainText(input.sellerEmail);
  await expect(body).not.toContainText(input.sellerAccessToken);
  await expect(body).not.toContainText(E2E_PASSWORD);
  await expect(body).not.toContainText(RAW_INTERNAL_TOKEN_SENTINEL);
  await expect(body).not.toContainText(RAW_REFRESH_TOKEN_SENTINEL);
  await expect(body).not.toContainText(RAW_PHONE_SENTINEL);
  await expect(body).not.toContainText(RAW_BUYER_EMAIL_SENTINEL);
  await expect(body).not.toContainText("passwordHash");
  await expect(body).not.toContainText("buyerEmail");
  await expect(body).not.toContainText("messageBody");
}
