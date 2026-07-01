import { expect, request, test } from "@playwright/test";
import {
  API_BASE_URL,
  E2E_PASSWORD,
  FULL_FLOW_ENABLED,
  assertApiIsAvailable,
  authHeader,
  createListing,
  createVerifiedUser,
  expectMyListingStatus,
  fetchFirstCategoryId,
  fetchPublicCsrfToken,
  installAuthRefreshRoute,
  safeResponseText
} from "./helpers/web-e2e-api";

const RAW_ACCESS_TOKEN_MARKER = "accessToken";
const RAW_REFRESH_TOKEN_MARKER = "refreshToken";
const RAW_PASSWORD_MARKER = E2E_PASSWORD;

test.describe("cart checkout flow", () => {
  test("buyer can add active sale listing to cart and complete mock iyzico checkout", async ({ page }) => {
    test.skip(
      !FULL_FLOW_ENABLED,
      "Set WEB_E2E_FULL_FLOW=1 and run the API + web app before this full-flow E2E."
    );
    test.setTimeout(90_000);

    const setupApi = await request.newContext({
      baseURL: API_BASE_URL,
      extraHTTPHeaders: {
        "content-type": "application/json"
      }
    });
    const sellerApi = await request.newContext({
      baseURL: API_BASE_URL,
      extraHTTPHeaders: {
        "content-type": "application/json"
      }
    });
    const buyerApi = await request.newContext({
      baseURL: API_BASE_URL,
      extraHTTPHeaders: {
        "content-type": "application/json"
      }
    });

    try {
      await assertApiIsAvailable(setupApi);

      const categoryId = await fetchFirstCategoryId(setupApi);
      const unique = Date.now();
      const listingTitle = `Web E2E checkout bebek arabası ${unique}`;

      const seller = await createVerifiedUser(sellerApi, {
        displayName: "Web E2E Checkout Seller",
        email: `web-e2e-checkout-seller-${unique}@babyloop.test`,
        locationCity: "İstanbul",
        password: E2E_PASSWORD
      });

      const buyer = await createVerifiedUser(buyerApi, {
        displayName: "Web E2E Checkout Buyer",
        email: `web-e2e-checkout-buyer-${unique}@babyloop.test`,
        locationCity: "İstanbul",
        password: E2E_PASSWORD
      });

      const listing = await createListing(sellerApi, {
        accessToken: seller.accessToken,
        categoryId,
        condition: "good",
        listingType: "sale",
        priceAmount: "1250",
        title: listingTitle
      });

      await installAuthRefreshRoute(page, buyer);

      await page.goto(`/listings/${listing.id}`, { waitUntil: "domcontentloaded" });

      await expect(page.getByRole("heading", { name: listingTitle })).toBeVisible({
        timeout: 15_000
      });

      const addToCartArea = page.getByTestId("listing-add-to-cart-action");
      const addToCartButton = addToCartArea.getByRole("button", { name: "Sepete ekle", exact: true });

      await expect(addToCartButton).toBeVisible({ timeout: 15_000 });
      await expect(addToCartButton).toBeEnabled();

      const addToCartResponsePromise = page.waitForResponse((response) => {
        return response.url().includes("/api/v1/cart/items") && response.request().method() === "POST";
      });

      await addToCartButton.click();

      const addToCartResponse = await addToCartResponsePromise;
      expect(addToCartResponse.ok(), await safeResponseText(addToCartResponse)).toBe(true);

      await expect(addToCartArea.getByText("İlan sepete eklendi.", { exact: true })).toBeVisible({
        timeout: 15_000
      });

      await page.goto("/cart", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Mock iyzico checkout", exact: true })).toBeVisible({
        timeout: 15_000
      });

      const cartItem = page.locator(`article[data-cart-listing-id="${listing.id}"]`);

      await expect(cartItem).toBeVisible({ timeout: 15_000 });
      await expect(cartItem).toContainText(listingTitle);
      await expect(cartItem).toContainText(/1250(?:\.00)?|1\.250/);

      const checkoutResponsePromise = page.waitForResponse((response) => {
        return response.url().includes("/api/v1/checkout/mock-iyzico") && response.request().method() === "POST";
      });

      await page.getByRole("button", { name: "Mock iyzico ile öde", exact: true }).click();

      const checkoutResponse = await checkoutResponsePromise;
      expect(checkoutResponse.ok(), await safeResponseText(checkoutResponse)).toBe(true);

      const successCard = page.getByTestId("cart-success-card");

      await expect(successCard).toBeVisible({ timeout: 15_000 });
      await expect(successCard).toContainText("Mock ödeme başarılı");
      await expect(successCard).toContainText("Order ID:");
      await expect(successCard).toContainText("Payment ID:");

      await expectMyListingStatus(sellerApi, {
        accessToken: seller.accessToken,
        listingId: listing.id,
        status: "sold"
      });

      await page.goto("/cart", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Mock iyzico checkout", exact: true })).toBeVisible({
        timeout: 15_000
      });
      await expect(page.locator(`article[data-cart-listing-id="${listing.id}"]`)).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Mock iyzico ile öde", exact: true })).toHaveCount(0);

      const csrfToken = await fetchPublicCsrfToken(buyerApi);
      const secondAddResponse = await buyerApi.post("/api/v1/cart/items", {
        headers: {
          ...authHeader(buyer.accessToken),
          "x-babyloop-csrf-token": csrfToken
        },
        data: {
          listingId: listing.id
        }
      });

      expect(secondAddResponse.ok()).toBe(false);

      await expectNoCheckoutSensitiveLeak(page, {
        buyerAccessToken: buyer.accessToken,
        sellerAccessToken: seller.accessToken,
        buyerEmail: buyer.user.email,
        sellerEmail: seller.user.email
      });
    } finally {
      await setupApi.dispose();
      await sellerApi.dispose();
      await buyerApi.dispose();
    }
  });
});

async function expectNoCheckoutSensitiveLeak(
  page: import("@playwright/test").Page,
  input: {
    buyerAccessToken: string;
    sellerAccessToken: string;
    buyerEmail: string;
    sellerEmail: string;
  }
): Promise<void> {
  const body = page.locator("body");

  await expect(body).not.toContainText(input.buyerAccessToken);
  await expect(body).not.toContainText(input.sellerAccessToken);
  await expect(body).not.toContainText(input.buyerEmail);
  await expect(body).not.toContainText(input.sellerEmail);
  await expect(body).not.toContainText(RAW_ACCESS_TOKEN_MARKER);
  await expect(body).not.toContainText(RAW_REFRESH_TOKEN_MARKER);
  await expect(body).not.toContainText(RAW_PASSWORD_MARKER);
}
