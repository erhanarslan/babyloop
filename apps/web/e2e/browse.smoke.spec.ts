import { expect, request, test, type APIRequestContext, type Page, type Route } from "@playwright/test";
import {
  API_BASE_URL,
  E2E_PASSWORD,
  FULL_FLOW_ENABLED,
  assertApiIsAvailable,
  createListing,
  createVerifiedUser,
  safeResponseText,
  type ApiResponse,
  type AuthPayload,
  type CategoryPayload,
} from "./helpers/web-e2e-api";

type BrowseSavedSearchCreateRequest = {
  authorization: string | null;
  categoryId: string | null;
  condition: string | null;
  csrfToken: string | null;
  hasImages: boolean;
  listingType: string | null;
  name: string;
  notificationsEnabled: boolean;
  priceMax: string | null;
  priceMin: string | null;
  q: string | null;
  sort: string;
};

type BrowseSavedSearchMockState = {
  createRequests: BrowseSavedSearchCreateRequest[];
};

const BROWSE_SAVED_SEARCH_CSRF_TOKEN = "browse-saved-search-e2e-csrf";
const BROWSE_SAVED_SEARCH_ID = "browse-saved-search-e2e-created";

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
      const saveQuery = `browsesave${unique}`;
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

      await assertBrowseSaveSearchCreatesSafePayload(page, {
        auth: seller,
        categoryId: category.id,
        query: saveQuery,
        sellerAccessToken: seller.accessToken,
        sellerEmail,
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

async function assertBrowseSaveSearchCreatesSafePayload(
  page: Page,
  input: {
    auth: AuthPayload;
    categoryId: string;
    query: string;
    sellerAccessToken: string;
    sellerEmail: string;
  },
): Promise<void> {
  const state = await installBrowseSavedSearchMocks(page, input.auth);

  await page.goto(
    `/browse?q=${encodeURIComponent(input.query)}&categoryId=${encodeURIComponent(input.categoryId)}&listingType=sale&condition=good&priceMin=1000&priceMax=5000&hasImages=true&sort=price_asc&limit=20`,
    { waitUntil: "domcontentloaded" },
  );

  const saveSearchPanel = page.locator(".save-search-panel");

  await expect(saveSearchPanel).toBeVisible({ timeout: 15_000 });
  await expect(saveSearchPanel.getByText("Aramayı kaydet", { exact: true })).toBeVisible();
  await expect(saveSearchPanel.getByText(`Arama: ${input.query}`, { exact: false })).toBeVisible();
  await expect(saveSearchPanel.getByText("Tip: sale", { exact: false })).toBeVisible();
  await expect(saveSearchPanel.getByText("Durum: good", { exact: false })).toBeVisible();
  await expect(saveSearchPanel.getByText("En az: 1000", { exact: false })).toBeVisible();
  await expect(saveSearchPanel.getByText("En çok: 5000", { exact: false })).toBeVisible();
  await expect(saveSearchPanel.getByText("Sadece görselli", { exact: false })).toBeVisible();
  await expect(saveSearchPanel.getByText("Sıralama: price_asc", { exact: false })).toBeVisible();

  await expectNoBrowseSensitiveLeak(page, {
    sellerAccessToken: input.sellerAccessToken,
    sellerEmail: input.sellerEmail,
  });

  const saveResponsePromise = page.waitForResponse((response) => {
    return response.url().includes("/api/v1/saved-searches") && response.request().method() === "POST";
  });

  await saveSearchPanel.getByRole("button", { name: "Bu aramayı kaydet", exact: true }).click();

  const saveResponse = await saveResponsePromise;

  expect(saveResponse.ok(), await saveResponse.text()).toBe(true);
  expect(state.createRequests).toEqual([
    {
      authorization: `Bearer ${input.auth.accessToken}`,
      categoryId: input.categoryId,
      condition: "good",
      csrfToken: BROWSE_SAVED_SEARCH_CSRF_TOKEN,
      hasImages: true,
      listingType: "sale",
      name: `Arama: ${input.query}`,
      notificationsEnabled: false,
      priceMax: "5000",
      priceMin: "1000",
      q: input.query,
      sort: "price_asc",
    },
  ]);

  await expect(
    saveSearchPanel.getByText("Arama kaydedildi. Hesabından tekrar açabilirsin.", { exact: true }),
  ).toBeVisible({
    timeout: 15_000,
  });

  await expectNoBrowseSensitiveLeak(page, {
    sellerAccessToken: input.sellerAccessToken,
    sellerEmail: input.sellerEmail,
  });
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

async function installBrowseSavedSearchMocks(
  page: Page,
  auth: AuthPayload,
): Promise<BrowseSavedSearchMockState> {
  const state: BrowseSavedSearchMockState = {
    createRequests: [],
  };

  await page.route("**/api/v1/auth/refresh", async (route) => {
    if (await fulfillOptions(route)) {
      return;
    }

    await fulfillJson(route, {
      ok: true,
      data: auth,
    });
  });

  await page.route("**/api/v1/auth/csrf", async (route) => {
    if (await fulfillOptions(route)) {
      return;
    }

    await fulfillJson(route, {
      ok: true,
      data: {
        csrfToken: BROWSE_SAVED_SEARCH_CSRF_TOKEN,
      },
    });
  });

  await page.route("**/api/v1/saved-searches", async (route) => {
    if (await fulfillOptions(route)) {
      return;
    }

    const request = route.request();
    const method = request.method().toUpperCase();

    if (method !== "POST") {
      await fulfillJson(
        route,
        {
          ok: false,
          error: {
            code: "WEB_E2E_UNHANDLED_BROWSE_SAVED_SEARCH_ROUTE",
            message: `Unhandled browse saved search E2E route: ${method}`,
          },
        },
        500,
      );
      return;
    }

    const body = (await request.postDataJSON()) as {
      categoryId?: string;
      condition?: string;
      hasImages?: boolean;
      listingType?: string;
      name?: string;
      notificationsEnabled?: boolean;
      priceMax?: string;
      priceMin?: string;
      q?: string;
      sort?: string;
    };
    const headers = request.headers();

    state.createRequests.push({
      authorization: headers.authorization ?? null,
      categoryId: body.categoryId ?? null,
      condition: body.condition ?? null,
      csrfToken: headers["x-babyloop-csrf-token"] ?? null,
      hasImages: Boolean(body.hasImages),
      listingType: body.listingType ?? null,
      name: body.name ?? "",
      notificationsEnabled: Boolean(body.notificationsEnabled),
      priceMax: body.priceMax ?? null,
      priceMin: body.priceMin ?? null,
      q: body.q ?? null,
      sort: body.sort ?? "newest",
    });

    await fulfillJson(route, {
      ok: true,
      data: {
        savedSearch: {
          id: BROWSE_SAVED_SEARCH_ID,
          name: body.name ?? "BabyLoop araması",
          q: body.q ?? "",
          categoryId: body.categoryId ?? null,
          listingType: body.listingType ?? null,
          condition: body.condition ?? null,
          priceMin: body.priceMin ?? null,
          priceMax: body.priceMax ?? null,
          hasImages: Boolean(body.hasImages),
          sort: body.sort ?? "newest",
          notificationsEnabled: Boolean(body.notificationsEnabled),
          createdAt: "2026-06-29T12:00:00.000Z",
          updatedAt: "2026-06-29T12:00:00.000Z",
        },
      },
    });
  });

  return state;
}

async function fulfillOptions(route: Route): Promise<boolean> {
  if (route.request().method().toUpperCase() !== "OPTIONS") {
    return false;
  }

  await route.fulfill({
    status: 204,
    headers: getCorsHeaders(route),
  });

  return true;
}

async function fulfillJson(
  route: Route,
  body: ApiResponse<unknown>,
  status = body.ok ? 200 : 400,
): Promise<void> {
  await route.fulfill({
    status,
    headers: {
      ...getCorsHeaders(route),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function getCorsHeaders(route: Route): Record<string, string> {
  const origin = route.request().headers().origin ?? "http://localhost:3000";

  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "authorization,content-type,x-babyloop-csrf-token",
    vary: "Origin",
  };
}
