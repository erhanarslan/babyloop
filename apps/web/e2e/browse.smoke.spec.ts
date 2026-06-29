import { expect, request, test, type APIRequestContext, type Page } from "@playwright/test";
import {
  API_BASE_URL,
  E2E_PASSWORD,
  FULL_FLOW_ENABLED,
  assertApiIsAvailable,
  createListing,
  createVerifiedUser,
  safeResponseText,
  type ApiResponse,
  type CategoryPayload,
} from "./helpers/web-e2e-api";

test.describe("browse page", () => {
  test("browse page opens", async ({ page }) => {
    await page.goto("/browse?sort=newest");

    await expect(page).toHaveTitle(/BabyLoop/i);
    await expect(page.getByRole("main")).toBeVisible();
  });

  test("covers browse filters, category landing, price sorting, no-results reset, and safe rendering", async ({
    page,
  }) => {
    test.skip(
      !FULL_FLOW_ENABLED,
      "Set WEB_E2E_FULL_FLOW=1 and run the API + web app before this full-flow E2E.",
    );
    test.setTimeout(75_000);

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
      const filterQuery = `browsefiltre${unique}`;
      const sortQuery = `browsesort${unique}`;
      const sellerEmail = `web-e2e-browse-seller-${unique}@babyloop.test`;

      const seller = await createVerifiedUser(sellerApi, {
        displayName: "Web E2E Browse Seller",
        email: sellerEmail,
        locationCity: "İstanbul",
        password: E2E_PASSWORD,
      });

      const filteredListing = await createListing(sellerApi, {
        accessToken: seller.accessToken,
        categoryId: category.id,
        condition: "good",
        listingType: "sale",
        priceAmount: "6500",
        title: `Web E2E ${filterQuery} bebek arabası`,
      });

      const affordableListing = await createListing(sellerApi, {
        accessToken: seller.accessToken,
        categoryId: category.id,
        condition: "good",
        listingType: "sale",
        priceAmount: "1000",
        title: `Web E2E ${sortQuery} uygun ürün`,
      });

      const expensiveListing = await createListing(sellerApi, {
        accessToken: seller.accessToken,
        categoryId: category.id,
        condition: "good",
        listingType: "sale",
        priceAmount: "9000",
        title: `Web E2E ${sortQuery} pahalı ürün`,
      });

      await assertBrowseFormFiltersListing(page, {
        categoryId: category.id,
        listingId: filteredListing.id,
        listingTitle: filteredListing.title,
        sellerAccessToken: seller.accessToken,
        sellerEmail,
        query: filterQuery,
      });

      await assertCategoryLandingKeepsFilters(page, {
        categorySlug: category.slug,
        listingTitle: filteredListing.title,
        sellerAccessToken: seller.accessToken,
        sellerEmail,
        query: filterQuery,
      });

      await assertPriceAscendingSort(page, {
        affordableTitle: affordableListing.title,
        categoryId: category.id,
        expensiveTitle: expensiveListing.title,
        query: sortQuery,
        sellerAccessToken: seller.accessToken,
        sellerEmail,
      });

      await assertNoResultsReset(page, {
        categoryId: category.id,
      });
    } finally {
      await setupApi.dispose();
      await sellerApi.dispose();
    }
  });
});

async function assertBrowseFormFiltersListing(
  page: Page,
  input: {
    categoryId: string;
    listingId: string;
    listingTitle: string;
    query: string;
    sellerAccessToken: string;
    sellerEmail: string;
  },
): Promise<void> {
  await page.goto("/browse?sort=newest", { waitUntil: "domcontentloaded" });

  const filtersPanel = page.getByLabel("Filtreler");
  await expect(filtersPanel).toBeVisible({ timeout: 15_000 });

  await filtersPanel.locator('input[name="q"]').fill(input.query);
  await filtersPanel.locator('select[name="categoryId"]').selectOption(input.categoryId);
  await filtersPanel.locator('select[name="listingType"]').selectOption("sale");
  await filtersPanel.locator('select[name="condition"]').selectOption("good");
  await filtersPanel.locator('input[name="priceMin"]').fill("6000");
  await filtersPanel.locator('input[name="priceMax"]').fill("7000");
  await filtersPanel.locator('select[name="sort"]').selectOption("price_desc");

  await filtersPanel.getByRole("button", { name: "Uygula", exact: true }).click();

  await expect
    .poll(() => new URL(page.url()).searchParams.get("q"), {
      timeout: 15_000,
    })
    .toBe(input.query);

  const browseUrl = new URL(page.url());

  expect(browseUrl.pathname).toBe("/browse");
  expect(browseUrl.searchParams.get("categoryId")).toBe(input.categoryId);
  expect(browseUrl.searchParams.get("listingType")).toBe("sale");
  expect(browseUrl.searchParams.get("condition")).toBe("good");
  expect(browseUrl.searchParams.get("priceMin")).toBe("6000");
  expect(browseUrl.searchParams.get("priceMax")).toBe("7000");
  expect(browseUrl.searchParams.get("sort")).toBe("price_desc");

  const listingCard = page.locator("article.listing-card").filter({
    hasText: input.listingTitle,
  });

  await expect(listingCard).toBeVisible({ timeout: 15_000 });
  await expect(listingCard.locator(`a[href="/listings/${input.listingId}"]`)).toBeVisible();
  await expect(listingCard).toContainText(/6500(?:\.00)? TRY/);

  const activeFilters = page.getByLabel("Active browse filters");
  await expect(activeFilters).toBeVisible();
  await expect(activeFilters).toContainText(`Search: ${input.query}`);
  await expect(activeFilters).toContainText("Category:");
  await expect(activeFilters).toContainText("Type:");
  await expect(activeFilters).toContainText("Condition:");
  await expect(activeFilters).toContainText("Min: 6000");
  await expect(activeFilters).toContainText("Max: 7000");
  await expect(activeFilters).toContainText("Sort:");

  await expectNoBrowseSensitiveLeak(page, {
    sellerAccessToken: input.sellerAccessToken,
    sellerEmail: input.sellerEmail,
  });
}

async function assertCategoryLandingKeepsFilters(
  page: Page,
  input: {
    categorySlug: string;
    listingTitle: string;
    query: string;
    sellerAccessToken: string;
    sellerEmail: string;
  },
): Promise<void> {
  await page.goto(
    `/categories/${input.categorySlug}?q=${encodeURIComponent(input.query)}&condition=good&listingType=sale&priceMin=6000&priceMax=7000&sort=price_desc&limit=20`,
    { waitUntil: "domcontentloaded" },
  );

  await expect
    .poll(() => new URL(page.url()).pathname, {
      timeout: 15_000,
    })
    .toBe(`/categories/${input.categorySlug}`);

  const categoryUrl = new URL(page.url());

  expect(categoryUrl.searchParams.get("categoryId")).toBeNull();
  expect(categoryUrl.searchParams.get("q")).toBe(input.query);
  expect(categoryUrl.searchParams.get("condition")).toBe("good");
  expect(categoryUrl.searchParams.get("listingType")).toBe("sale");
  expect(categoryUrl.searchParams.get("priceMin")).toBe("6000");
  expect(categoryUrl.searchParams.get("priceMax")).toBe("7000");
  expect(categoryUrl.searchParams.get("sort")).toBe("price_desc");

  await expect(page.locator(".category-landing-hero")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByLabel("Filtreler").locator('select[name="categoryId"]')).toHaveCount(0);
  await expect(page.locator("article.listing-card").filter({ hasText: input.listingTitle })).toBeVisible({
    timeout: 15_000,
  });

  await expectNoBrowseSensitiveLeak(page, {
    sellerAccessToken: input.sellerAccessToken,
    sellerEmail: input.sellerEmail,
  });
}

async function assertPriceAscendingSort(
  page: Page,
  input: {
    affordableTitle: string;
    categoryId: string;
    expensiveTitle: string;
    query: string;
    sellerAccessToken: string;
    sellerEmail: string;
  },
): Promise<void> {
  await page.goto(
    `/browse?q=${encodeURIComponent(input.query)}&categoryId=${encodeURIComponent(input.categoryId)}&listingType=sale&condition=good&sort=price_asc&limit=20`,
    { waitUntil: "domcontentloaded" },
  );

  const cards = page.locator("article.listing-card");
  const affordableCard = cards.filter({ hasText: input.affordableTitle });
  const expensiveCard = cards.filter({ hasText: input.expensiveTitle });

  await expect(affordableCard).toBeVisible({ timeout: 15_000 });
  await expect(expensiveCard).toBeVisible({ timeout: 15_000 });

  await expect(affordableCard).toContainText(/1000(?:\.00)? TRY/);
  await expect(expensiveCard).toContainText(/9000(?:\.00)? TRY/);

  const affordableIndex = await cards.evaluateAll((items, title) => {
    return items.findIndex((item) => item.textContent?.includes(String(title)));
  }, input.affordableTitle);
  const expensiveIndex = await cards.evaluateAll((items, title) => {
    return items.findIndex((item) => item.textContent?.includes(String(title)));
  }, input.expensiveTitle);

  expect(affordableIndex).toBeGreaterThanOrEqual(0);
  expect(expensiveIndex).toBeGreaterThanOrEqual(0);
  expect(affordableIndex).toBeLessThan(expensiveIndex);

  await expectNoBrowseSensitiveLeak(page, {
    sellerAccessToken: input.sellerAccessToken,
    sellerEmail: input.sellerEmail,
  });
}

async function assertNoResultsReset(
  page: Page,
  input: {
    categoryId: string;
  },
): Promise<void> {
  const impossibleQuery = `noresult${Date.now()}zzzz`;

  await page.goto(
    `/browse?q=${encodeURIComponent(impossibleQuery)}&categoryId=${encodeURIComponent(input.categoryId)}&listingType=donation&condition=needs_repair&priceMin=999999&priceMax=1000000&hasImages=true&sort=price_desc&limit=20`,
    { waitUntil: "domcontentloaded" },
  );

  const main = page.getByRole("main");
  await expect(main).toContainText("0 ilan", { timeout: 15_000 });
  await expect(main).toContainText("Sonuç yok");
  await expect(main).toContainText("Bu filtrelerle ilan bulunamadı");

  const activeFilters = page.getByLabel("Active browse filters");
  await expect(activeFilters).toBeVisible();
  await expect(activeFilters).toContainText(`Search: ${impossibleQuery}`);
  await expect(activeFilters).toContainText("Category:");
  await expect(activeFilters).toContainText("Type:");
  await expect(activeFilters).toContainText("Condition:");
  await expect(activeFilters).toContainText("Min: 999999");
  await expect(activeFilters).toContainText("Max: 1000000");
  await expect(activeFilters).toContainText("Images only");
  await expect(activeFilters).toContainText("Sort:");

  await expect(main.getByRole("link", { name: "Filtreleri temizle", exact: true })).toHaveAttribute(
    "href",
    "/browse",
  );
  await expect(activeFilters.locator("a.filter-chip-clear")).toHaveAttribute("href", "/browse");

  await expect(page.locator("article.listing-card")).toHaveCount(0);
}

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
