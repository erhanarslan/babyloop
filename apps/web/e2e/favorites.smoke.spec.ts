import { expect, request, test } from "@playwright/test";
import {
  API_BASE_URL,
  E2E_PASSWORD,
  FULL_FLOW_ENABLED,
  assertApiIsAvailable,
  createListing,
  createVerifiedUser,
  expectFavoriteState,
  fetchFirstCategoryId,
  loginWithUi,
} from "./helpers/web-e2e-api";

test.describe("favorites flow", () => {
  test("buyer can favorite and remove a public listing", async ({ page }) => {
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
    const buyerApi = await request.newContext({
      baseURL: API_BASE_URL,
      extraHTTPHeaders: {
        "content-type": "application/json",
      },
    });

    try {
      await assertApiIsAvailable(setupApi);

      const categoryId = await fetchFirstCategoryId(setupApi);
      const unique = Date.now();
      const listingTitle = `Web E2E favori bebek arabası ${unique}`;

      const seller = await createVerifiedUser(sellerApi, {
        displayName: "Web E2E Fav Seller",
        email: `web-e2e-fav-seller-${unique}@babyloop.test`,
        locationCity: "İstanbul",
        password: E2E_PASSWORD,
      });

      const buyerEmail = `web-e2e-fav-buyer-${unique}@babyloop.test`;

      const buyer = await createVerifiedUser(buyerApi, {
        displayName: "Web E2E Fav Buyer",
        email: buyerEmail,
        locationCity: "İstanbul",
        password: E2E_PASSWORD,
      });

      const listing = await createListing(sellerApi, {
        accessToken: seller.accessToken,
        categoryId,
        title: listingTitle,
      });

      await loginWithUi(page, {
        email: buyerEmail,
        password: E2E_PASSWORD,
      });

      await page.goto(`/listings/${listing.id}`);
      await expect(page.getByRole("heading", { name: listingTitle })).toBeVisible({
        timeout: 15_000,
      });

      const favoriteButton = page.getByRole("button", { name: "Favori", exact: true });
      await expect(favoriteButton).toBeVisible({ timeout: 15_000 });

      await expect(favoriteButton).toBeEnabled({ timeout: 15_000 });
      await favoriteButton.click();

      await expectFavoriteState(buyerApi, {
        accessToken: buyer.accessToken,
        listingId: listing.id,
        favorited: true,
      });

      await page.goto("/favorites");

      await expect(page.getByRole("heading", { name: "Favoriler", exact: true })).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByText(listingTitle, { exact: true })).toBeVisible();

      await page.getByRole("button", { name: "Favoriden çıkar" }).click();

      await expectFavoriteState(buyerApi, {
        accessToken: buyer.accessToken,
        listingId: listing.id,
        favorited: false,
      });

      await expect(page.getByText("Henüz favori ilan yok.")).toBeVisible({
        timeout: 15_000,
      });
    } finally {
      await setupApi.dispose();
      await sellerApi.dispose();
      await buyerApi.dispose();
    }
  });
});
