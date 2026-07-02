import { expect, request, test, type Page } from "@playwright/test";
import {
  API_BASE_URL,
  E2E_PASSWORD,
  FULL_FLOW_ENABLED,
  assertApiIsAvailable,
  createListing,
  createVerifiedUser,
  fetchFirstCategoryId,
} from "./helpers/web-e2e-api";

const RAW_PASSWORD_SENTINEL = E2E_PASSWORD;
const RAW_ACCESS_TOKEN_MARKER = "eyJ";
const RAW_INTERNAL_TOKEN_SENTINEL = "accessToken";
const RAW_PHONE_SENTINEL = "+905551112233";

test.describe("listing detail page", () => {
  test("guest can view a public listing detail with safe seller summary and buyer CTAs", async ({ page }) => {
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
      const sellerDisplayName = "Web E2E Detail Seller";
      const sellerEmail = `web-e2e-detail-seller-${unique}@babyloop.test`;
      const listingTitle = `Web E2E detay bebek arabası ${unique}`;

      const seller = await createVerifiedUser(sellerApi, {
        displayName: sellerDisplayName,
        email: sellerEmail,
        locationCity: "İstanbul",
        password: E2E_PASSWORD,
      });

      const listing = await createListing(sellerApi, {
        accessToken: seller.accessToken,
        categoryId,
        title: listingTitle,
      });

      await page.goto(`/listings/${listing.id}`, { waitUntil: "domcontentloaded" });

      await expect(page).toHaveURL(new RegExp(`/listings/${listing.id}$`), {
        timeout: 15_000,
      });

      const main = page.getByRole("main");
      await expect(page.getByRole("heading", { name: listingTitle })).toBeVisible({
        timeout: 15_000,
      });

      await expect(main).toContainText(/6500(?:\.00)? TRY/);
      await expect(main).toContainText("İstanbul");
      await expect(main).toContainText("Web E2E testi için oluşturulan güvenli marketplace ilanı.");
      await expect(main).toContainText("Kategori");
      await expect(main).toContainText("Tip");
      await expect(main).toContainText("Durum");
      await expect(main).toContainText("İlan");

      await expect(page.getByAltText(`Ürün görseli: ${listingTitle}`)).toHaveCount(0);
      await expect(page.getByText("Ürün görseli yok", { exact: true })).toBeVisible();

      await expect(main).toContainText(sellerDisplayName);
      await expect(main).toContainText("BabyLoop içinde mesajlaş");
      await expect(
        main.getByRole("link", { name: /^Satıcıya mesaj atmak için/i }),
      ).toHaveAttribute("href", "/login");

      const favoriteButton = page.getByRole("button", { name: "Favori", exact: true });
      await expect(favoriteButton).toBeVisible({
        timeout: 15_000,
      });
      await expect(favoriteButton).toBeEnabled();


      await expectNoListingDetailSensitiveLeak(page, {
        sellerEmail,
        sellerAccessToken: seller.accessToken,
      });
    } finally {
      await setupApi.dispose();
      await sellerApi.dispose();
    }
  });
});

async function expectNoListingDetailSensitiveLeak(
  page: Page,
  input: {
    sellerEmail: string;
    sellerAccessToken: string;
  },
): Promise<void> {
  const body = page.locator("body");

  await expect(body).not.toContainText(input.sellerEmail);
  await expect(body).not.toContainText(input.sellerAccessToken);
  await expect(body).not.toContainText(RAW_PASSWORD_SENTINEL);
  await expect(body).not.toContainText(RAW_INTERNAL_TOKEN_SENTINEL);
  await expect(body).not.toContainText(RAW_PHONE_SENTINEL);
  await expect(body).not.toContainText("<script");

  // JWT-like fragments should not be rendered as user-visible text.
  await expect(body).not.toContainText(RAW_ACCESS_TOKEN_MARKER);
}
