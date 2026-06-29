import { expect, request, test, type APIRequestContext, type Page } from "@playwright/test";
import {
  API_BASE_URL,
  E2E_PASSWORD,
  FULL_FLOW_ENABLED,
  assertApiIsAvailable,
  authHeader,
  createVerifiedUser,
  fetchPublicCsrfToken,
  safeResponseText,
  type ApiResponse,
  type CategoryPayload,
} from "./helpers/web-e2e-api";

type BrowseListingPayload = {
  listing: {
    id: string;
    title: string;
  };
};

test.describe("browse page", () => {
  test("browse page opens", async ({ page }) => {
    await page.goto("/browse?sort=newest");

    await expect(page).toHaveTitle(/BabyLoop/i);
    await expect(page.getByRole("main")).toBeVisible();
  });

  test("applies search, category, type, condition, price, and sort filters", async ({ page }) => {
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

      const category = await fetchFirstCategory(setupApi);
      const unique = Date.now();
      const uniqueQuery = `browsefiltre${unique}`;
      const sellerEmail = `web-e2e-browse-seller-${unique}@babyloop.test`;
      const listingTitle = `Web E2E ${uniqueQuery} bebek arabası`;

      const seller = await createVerifiedUser(sellerApi, {
        displayName: "Web E2E Browse Seller",
        email: sellerEmail,
        locationCity: "İstanbul",
        password: E2E_PASSWORD,
      });

      const listing = await createBrowseListing(sellerApi, {
        accessToken: seller.accessToken,
        categoryId: category.id,
        condition: "good",
        listingType: "sale",
        priceAmount: "6500",
        title: listingTitle,
      });

      await page.goto("/browse?sort=newest", { waitUntil: "domcontentloaded" });

      const filtersPanel = page.getByLabel("Filtreler");
      await expect(filtersPanel).toBeVisible({ timeout: 15_000 });

      await filtersPanel.getByLabel("Arama").fill(uniqueQuery);
      await filtersPanel.locator('select[name="categoryId"]').selectOption(category.id);
      await filtersPanel.locator('select[name="listingType"]').selectOption("sale");
      await filtersPanel.locator('select[name="condition"]').selectOption("good");
      await filtersPanel.getByLabel("En az").fill("6000");
      await filtersPanel.getByLabel("En çok").fill("7000");
      await filtersPanel.locator('select[name="sort"]').selectOption("price_desc");

      await filtersPanel.getByRole("button", { name: "Uygula", exact: true }).click();

      await expect
        .poll(() => new URL(page.url()).searchParams.get("q"), {
          timeout: 15_000,
        })
        .toBe(uniqueQuery);

      const browseUrl = new URL(page.url());

      expect(browseUrl.pathname).toBe("/browse");
      expect(browseUrl.searchParams.get("categoryId")).toBe(category.id);
      expect(browseUrl.searchParams.get("listingType")).toBe("sale");
      expect(browseUrl.searchParams.get("condition")).toBe("good");
      expect(browseUrl.searchParams.get("priceMin")).toBe("6000");
      expect(browseUrl.searchParams.get("priceMax")).toBe("7000");
      expect(browseUrl.searchParams.get("sort")).toBe("price_desc");

      const listingCard = page.locator("article.listing-card").filter({
        hasText: listingTitle,
      });

      await expect(listingCard).toBeVisible({ timeout: 15_000 });
      await expect(listingCard.locator(`a[href="/listings/${listing.id}"]`)).toBeVisible();
      await expect(listingCard).toContainText(/6500(?:\.00)? TRY/);

      const activeFilters = page.getByLabel("Active browse filters");
      await expect(activeFilters).toBeVisible();
      await expect(activeFilters).toContainText(`Search: ${uniqueQuery}`);
      await expect(activeFilters).toContainText("Category:");
      await expect(activeFilters).toContainText("Type:");
      await expect(activeFilters).toContainText("Condition:");
      await expect(activeFilters).toContainText("Min: 6000");
      await expect(activeFilters).toContainText("Max: 7000");
      await expect(activeFilters).toContainText("Sort:");

      await expectNoBrowseSensitiveLeak(page, {
        sellerAccessToken: seller.accessToken,
        sellerEmail,
      });

      await page.goto(
        `/categories/${category.slug}?q=${encodeURIComponent(uniqueQuery)}&condition=good&listingType=sale&priceMin=6000&priceMax=7000&sort=price_desc&limit=20`,
        { waitUntil: "domcontentloaded" },
      );

      await expect
        .poll(() => new URL(page.url()).pathname, {
          timeout: 15_000,
        })
        .toBe(`/categories/${category.slug}`);

      const categoryUrl = new URL(page.url());

      expect(categoryUrl.searchParams.get("categoryId")).toBeNull();
      expect(categoryUrl.searchParams.get("q")).toBe(uniqueQuery);
      expect(categoryUrl.searchParams.get("condition")).toBe("good");
      expect(categoryUrl.searchParams.get("listingType")).toBe("sale");
      expect(categoryUrl.searchParams.get("priceMin")).toBe("6000");
      expect(categoryUrl.searchParams.get("priceMax")).toBe("7000");
      expect(categoryUrl.searchParams.get("sort")).toBe("price_desc");

      await expect(page.locator('section[aria-label$=" category landing"]')).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByLabel("Filtreler").locator('select[name="categoryId"]')).toHaveCount(0);
      await expect(
        page.locator("article.listing-card").filter({
          hasText: listingTitle,
        }),
      ).toBeVisible({ timeout: 15_000 });

      await expectNoBrowseSensitiveLeak(page, {
        sellerAccessToken: seller.accessToken,
        sellerEmail,
      });
    } finally {
      await setupApi.dispose();
      await sellerApi.dispose();
    }
  });
});

async function fetchFirstCategory(
  api: APIRequestContext,
): Promise<CategoryPayload["categories"][number]> {
  const response = await api.get("/api/v1/categories");
  expect(response.ok(), await safeResponseText(response)).toBe(true);

  const body = (await response.json()) as ApiResponse<CategoryPayload>;
  expect(body.ok).toBe(true);

  if (!body.ok || body.data.categories.length === 0) {
    throw new Error("No category exists for web browse E2E setup.");
  }

  return body.data.categories[0]!;
}

async function createBrowseListing(
  api: APIRequestContext,
  input: {
    accessToken: string;
    categoryId: string;
    condition: "new" | "like_new" | "good" | "fair" | "needs_repair";
    listingType: "sale" | "swap" | "donation";
    priceAmount: string;
    title: string;
  },
): Promise<BrowseListingPayload["listing"]> {
  const csrfToken = await fetchPublicCsrfToken(api);

  const response = await api.post("/api/v1/listings", {
    headers: {
      ...authHeader(input.accessToken),
      "x-babyloop-csrf-token": csrfToken,
    },
    data: {
      categoryId: input.categoryId,
      listingType: input.listingType,
      title: input.title,
      description: "Web E2E browse filtre testi için oluşturulan güvenli ilan.",
      priceAmount: input.priceAmount,
      currency: "TRY",
      condition: input.condition,
    },
  });

  expect(response.ok(), await safeResponseText(response)).toBe(true);

  const body = (await response.json()) as ApiResponse<BrowseListingPayload>;
  expect(body.ok).toBe(true);

  if (!body.ok) {
    throw new Error("Browse listing setup failed.");
  }

  return body.data.listing;
}

async function expectNoBrowseSensitiveLeak(
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
  await expect(body).not.toContainText("accessToken");
  await expect(body).not.toContainText("refreshToken");
}
