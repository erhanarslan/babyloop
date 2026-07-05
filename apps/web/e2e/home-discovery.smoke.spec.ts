import { expect, test, type Page, type Route } from "@playwright/test";

const LATEST_LISTING_ID = "web-e2e-home-latest-1";
const LATEST_LISTING_TITLE = "Web E2E ana sayfa bebek arabası";
const SUGGESTION_LISTING_ID = "web-e2e-home-suggestion-1";
const SUGGESTION_LISTING_TITLE = "Web E2E arama önerisi puset";
const RAW_EMAIL_SENTINEL = "web-e2e-home-seller@babyloop.test";
const RAW_ACCESS_TOKEN_SENTINEL = "mock-home-access-token";
const RAW_PASSWORD_SENTINEL = "Password12345!";

test.describe("home discovery", () => {
  test("home page supports search navigation, latest listings discovery, and safe rendering", async ({
    page,
  }) => {
    await installHomeDiscoveryRoutes(page);

    await page.goto("/", { waitUntil: "domcontentloaded" });

    const main = page.getByRole("main");
    await expect(main).toBeVisible({ timeout: 15_000 });

    await expect(page.getByLabel("Öne çıkan ikinci el bebek ürünleri")).toBeVisible({
      timeout: 15_000,
    });

    await expect(page.locator("#latest-listings")).toBeVisible({
      timeout: 15_000,
    });

    await expect(page.getByText(LATEST_LISTING_TITLE, { exact: true })).toBeVisible({
      timeout: 15_000,
    });

    const latestListingLink = page.locator(`a[href="/listings/${LATEST_LISTING_ID}"]`).first();
    await expect(latestListingLink).toBeVisible();

    const viewAllLatestHref = await page
      .locator("#latest-listings")
      .getByRole("link", { name: /Tümünü gör|Diğer ilanları gör/i })
      .first()
      .getAttribute("href");
    expect(viewAllLatestHref).toBe("/browse?sort=newest");

    await page.getByRole("button", { name: "Alışverişe başla", exact: true }).click();
    await expect
      .poll(
        async () => {
          return await page.evaluate(() => {
            const latest = document.getElementById("latest-listings");

            if (!latest) {
              return false;
            }

            const rect = latest.getBoundingClientRect();

            return rect.top < window.innerHeight && rect.bottom > 0;
          });
        },
        {
          timeout: 10_000,
        },
      )
      .toBe(true);

    const searchBox = page.getByRole("searchbox").first();
    await expect(searchBox).toBeVisible();

    await searchBox.fill("bebek arabası <script>");
    await searchBox.press("Enter");

    await expect(page).toHaveURL(/\/browse/, {
      timeout: 15_000,
    });

    const browseUrl = new URL(page.url());
    expect(browseUrl.pathname).toBe("/browse");
    expect(browseUrl.searchParams.get("q")).toBe("bebek arabası <script>");

    await expectNoHomeSensitiveLeak(page);
  });

  test("home search uses safe suggestions or safe browse fallback", async ({ page }) => {
    await installHomeDiscoveryRoutes(page);

    await page.goto("/", { waitUntil: "domcontentloaded" });

    const searchBox = page.getByRole("searchbox").first();
    await expect(searchBox).toBeVisible();

    await searchBox.click();
    await searchBox.fill("");
    await searchBox.pressSequentially("puset", { delay: 25 });

    const suggestionByRole = page.getByRole("option", { name: new RegExp(SUGGESTION_LISTING_TITLE) }).first();
    const suggestionByText = page.getByText(new RegExp(SUGGESTION_LISTING_TITLE)).first();
    const suggestionCandidate = suggestionByRole.or(suggestionByText).first();

    const suggestionVisible = await suggestionCandidate.isVisible({ timeout: 5_000 }).catch(() => false);

    if (suggestionVisible) {
      await suggestionCandidate.click();
    } else {
      await searchBox.press("Enter");

      const reachedBrowseAfterEnter = await page
        .waitForURL(/\/browse\?q=puset|\/browse.*[?&]q=puset/, { timeout: 3_000 })
        .then(() => true)
        .catch(() => false);

      if (!reachedBrowseAfterEnter) {
        await searchBox.evaluate((element) => {
          const form = element instanceof HTMLElement ? element.closest("form") : null;
          if (form instanceof HTMLFormElement) {
            form.requestSubmit();
          }
        });
      }

      await expect(page).toHaveURL(/\/browse(?:\?|$)/, { timeout: 15_000 });
      await expect(page.locator("main").first()).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByText(/accessToken|refreshToken|passwordHash|document\.cookie|sessionStorage/i)).toHaveCount(0);
    }

    await expect(page).toHaveURL(/\/browse/, {
      timeout: 15_000,
    });

    const browseUrl = new URL(page.url());
    expect(browseUrl.pathname).toBe("/browse");

    const queryValue = browseUrl.searchParams.get("q");
    if (queryValue !== null) {
      expect([SUGGESTION_LISTING_TITLE, "puset"]).toContain(queryValue);
    } else {
      expect(browseUrl.searchParams.toString()).toMatch(/(?:^|&)city=/);
    }

    await expectNoHomeSensitiveLeak(page);
  });
});

async function installHomeDiscoveryRoutes(page: Page): Promise<void> {
  await page.route("**/api/v1/listings?*", async (route) => {
    const url = new URL(route.request().url());
    const query = url.searchParams.get("q");

    if (query) {
      await fulfillJson(route, {
        ok: true,
        data: {
          listings: [buildSuggestionListing()],
          pagination: {
            limit: 5,
            offset: 0,
            total: 1,
          },
        },
      });
      return;
    }

    await fulfillJson(route, {
      ok: true,
      data: {
        listings: [buildLatestListing()],
        pagination: {
          limit: Number(url.searchParams.get("limit") ?? "4"),
          offset: Number(url.searchParams.get("offset") ?? "0"),
          total: 1,
        },
      },
    });
  });

  await page.route(`**/api/v1/listings/${LATEST_LISTING_ID}`, async (route) => {
    await fulfillJson(route, {
      ok: true,
      data: {
        listing: {
          ...buildLatestListing(),
          description: "Web E2E ana sayfa listing açıklaması.",
          images: [],
          seller: {
            id: "web-e2e-home-seller-profile",
            displayName: "Web E2E Home Seller",
            avatarUrl: null,
            locationCity: "İstanbul",
          },
          updatedAt: "2026-06-20T10:00:00.000Z",
        },
      },
    });
  });

  await page.route(`**/api/v1/listings/${SUGGESTION_LISTING_ID}`, async (route) => {
    await fulfillJson(route, {
      ok: true,
      data: {
        listing: {
          ...buildSuggestionListing(),
          description: "Web E2E search suggestion listing açıklaması.",
          images: [],
          seller: {
            id: "web-e2e-home-suggestion-seller-profile",
            displayName: "Web E2E Search Seller",
            avatarUrl: null,
            locationCity: "İstanbul",
          },
          updatedAt: "2026-06-20T10:00:00.000Z",
        },
      },
    });
  });
}

function buildLatestListing() {
  return {
    id: LATEST_LISTING_ID,
    title: LATEST_LISTING_TITLE,
    price: {
      amount: "3200.00",
      currency: "TRY",
    },
    favoriteCount: 0,
    status: "active",
    listingType: "sale",
    condition: "good",
    category: {
      id: "web-e2e-home-category-strollers",
      name: "Bebek Arabaları",
      slug: "bebek-arabalari",
    },
    firstImage: null,
    images: [],
    createdAt: "2026-06-20T10:00:00.000Z",
  };
}

function buildSuggestionListing() {
  return {
    id: SUGGESTION_LISTING_ID,
    title: SUGGESTION_LISTING_TITLE,
    price: {
      amount: "1800.00",
      currency: "TRY",
    },
    favoriteCount: 0,
    status: "active",
    listingType: "sale",
    condition: "good",
    category: {
      id: "web-e2e-home-category-strollers",
      name: "Bebek Arabaları",
      slug: "bebek-arabalari",
    },
    firstImage: null,
    images: [],
    createdAt: "2026-06-20T11:00:00.000Z",
  };
}

async function fulfillJson(route: Route, body: unknown): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: getCorsHeaders(route),
    body: JSON.stringify(body),
  });
}

function getCorsHeaders(route: Route): Record<string, string> {
  const origin = route.request().headers()["origin"] ?? "http://localhost:3000";

  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "authorization,content-type,x-babyloop-csrf-token",
    vary: "Origin",
  };
}

async function expectNoHomeSensitiveLeak(page: Page): Promise<void> {
  const body = page.locator("body");

  await expect(body).not.toContainText(RAW_EMAIL_SENTINEL);
  await expect(body).not.toContainText(RAW_ACCESS_TOKEN_SENTINEL);
  await expect(body).not.toContainText(RAW_PASSWORD_SENTINEL);
  await expect(body).not.toContainText("accessToken");
  await expect(body).not.toContainText("refreshToken");
}
