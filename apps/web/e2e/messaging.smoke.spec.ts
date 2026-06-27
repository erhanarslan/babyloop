import { expect, request, test } from "@playwright/test";
import {
  API_BASE_URL,
  E2E_PASSWORD,
  FULL_FLOW_ENABLED,
  assertApiIsAvailable,
  createListing,
  createVerifiedUser,
  fetchFirstCategoryId,
  loginWithUi,
} from "./helpers/web-e2e-api";

test.describe("messaging flow", () => {
  test("buyer can start a conversation from listing detail and send a message", async ({ page }) => {
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
      const sellerDisplayName = "Web E2E Message Seller";
      const listingTitle = `Web E2E mesajlaşma bebek arabası ${unique}`;
      const messageText = `Merhaba, bu ürün hâlâ uygun mu? ${unique}`;

      const seller = await createVerifiedUser(sellerApi, {
        displayName: sellerDisplayName,
        email: `web-e2e-msg-seller-${unique}@babyloop.test`,
        locationCity: "İstanbul",
        password: E2E_PASSWORD,
      });

      const buyerEmail = `web-e2e-msg-buyer-${unique}@babyloop.test`;

      await createVerifiedUser(buyerApi, {
        displayName: "Web E2E Message Buyer",
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

      await expect(page.getByText("Mesaj atmadan önce")).toBeVisible({
        timeout: 15_000,
      });

      const openConversationResponsePromise = page.waitForResponse((response) => {
        return response.url().includes("/api/v1/conversations") && response.request().method() === "POST";
      });

      await page.getByRole("button", { name: /Mesaj/i }).click();

      const openConversationResponse = await openConversationResponsePromise;
      expect(openConversationResponse.ok(), await openConversationResponse.text()).toBe(true);

      await expect(page).toHaveURL(/\/conversations\/[a-zA-Z0-9-]+$/, {
        timeout: 15_000,
      });

      await expect(page.getByRole("heading", { name: sellerDisplayName })).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByRole("link", { name: listingTitle, exact: true })).toBeVisible();

      const messageBox = page.getByRole("textbox", { name: "Mesaj" });
      await expect(messageBox).toBeVisible();

      await messageBox.fill(messageText);

      const sendMessageResponsePromise = page.waitForResponse((response) => {
        return response.url().includes("/messages") && response.request().method() === "POST";
      });

      await page.getByRole("button", { name: "Gönder" }).click();

      const sendMessageResponse = await sendMessageResponsePromise;
      expect(sendMessageResponse.ok(), await sendMessageResponse.text()).toBe(true);

      await expect(page.getByText(messageText, { exact: true })).toBeVisible({
        timeout: 15_000,
      });
    } finally {
      await setupApi.dispose();
      await sellerApi.dispose();
      await buyerApi.dispose();
    }
  });
});
