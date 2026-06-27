import { expect, request, test } from "@playwright/test";
import {
  API_BASE_URL,
  E2E_PASSWORD,
  FULL_FLOW_ENABLED,
  assertApiIsAvailable,
  createConversation,
  createListing,
  createVerifiedUser,
  fetchFirstCategoryId,
  installAuthRefreshRoute,
} from "./helpers/web-e2e-api";

test.describe("messaging safety flow", () => {
  test("unsafe script-like message is blocked before sending", async ({ page }) => {
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
      const sellerDisplayName = "Web E2E Safe Msg Seller";
      const listingTitle = `Web E2E güvenli mesaj ürünü ${unique}`;
      const buyerEmail = `web-e2e-safe-msg-buyer-${unique}@babyloop.test`;

      const seller = await createVerifiedUser(sellerApi, {
        displayName: sellerDisplayName,
        email: `web-e2e-safe-msg-seller-${unique}@babyloop.test`,
        locationCity: "İstanbul",
        password: E2E_PASSWORD,
      });

      const buyer = await createVerifiedUser(buyerApi, {
        displayName: "Web E2E Safe Msg Buyer",
        email: buyerEmail,
        locationCity: "İstanbul",
        password: E2E_PASSWORD,
      });

      const listing = await createListing(sellerApi, {
        accessToken: seller.accessToken,
        categoryId,
        title: listingTitle,
      });

      const conversation = await createConversation(buyerApi, {
        accessToken: buyer.accessToken,
        listingId: listing.id,
      });

      await installAuthRefreshRoute(page, buyer);

      let unsafeSendRequestCount = 0;

      page.on("request", (requestItem) => {
        const url = requestItem.url();

        if (
          requestItem.method() === "POST" &&
          url.includes(`/api/v1/conversations/${conversation.id}/messages`)
        ) {
          unsafeSendRequestCount += 1;
        }
      });

      await page.goto(`/conversations/${conversation.id}`);
      await expect(page).toHaveURL(new RegExp(`/conversations/${conversation.id}$`), {
        timeout: 15_000,
      });
      await expect(page.getByRole("heading", { name: sellerDisplayName, exact: true })).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByRole("link", { name: listingTitle, exact: true })).toBeVisible();

      const messageBox = page.getByRole("textbox", { name: "Mesaj" });
      await expect(messageBox).toBeVisible();

      await messageBox.fill("<script>alert('xss')</script>");

      await expect(
        page.getByText("Kod benzeri metni çıkarıp ürüne odaklı kısa bir mesaj yaz.", { exact: true }),
      ).toBeVisible();

      await page.getByRole("button", { name: "Gönder", exact: true }).click();

      await expect(
        page.getByText("Bu mesaj güvenli görünmüyor. Lütfen özel bilgi veya kod benzeri içerik olmadan tekrar yaz.", {
          exact: true,
        }),
      ).toBeVisible();

      await expect
        .poll(() => unsafeSendRequestCount, {
          intervals: [250, 500],
          timeout: 1_500,
        })
        .toBe(0);
    } finally {
      await setupApi.dispose();
      await sellerApi.dispose();
      await buyerApi.dispose();
    }
  });
});
