import { expect, request, test } from "@playwright/test";
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

test.describe("my listings flow", () => {
  test("seller can see own reserved listing in listing management", async ({ page }) => {
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
      await expect(page.getByRole("heading", { name: "İlanlarım", exact: true })).toBeVisible({
        timeout: 15_000,
      });

      const listingCard = page.locator(`article[data-listing-id="${listing.id}"]`);

      await expect(listingCard).toBeVisible({ timeout: 15_000 });
      await expect(listingCard).toHaveAttribute("data-listing-status", "reserved");
      await expect(listingCard.locator('[data-listing-status-label="reserved"]')).toBeVisible();

      await page.locator('nav[aria-label="İlan durumu"] [data-status-filter="reserved"]').click();
      await expect(listingCard).toBeVisible({ timeout: 15_000 });

      await page.locator('nav[aria-label="İlan durumu"] [data-status-filter="active"]').click();
      await expect(listingCard).toHaveCount(0);
    } finally {
      await setupApi.dispose();
      await sellerApi.dispose();
    }
  });
});
