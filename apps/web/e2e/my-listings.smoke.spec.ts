import { expect, test, type Page, type Route } from "@playwright/test";
import {
  FULL_FLOW_ENABLED,
  installAuthRefreshRoute,
  type ApiResponse,
  type AuthPayload,
} from "./helpers/web-e2e-api";

type MockMyListingsPayload = {
  listings: MockListingSummary[];
};

type MockListingSummary = {
  id: string;
  title: string;
  description: string;
  status: "active" | "reserved" | "sold" | "archived";
  category: {
    id: string;
    name: string;
    slug: string;
  };
  price: {
    amount: string;
    currency: string;
  };
  condition: "new" | "like_new" | "good" | "fair" | "needs_repair";
  listingType: "sale" | "swap" | "donation";
  favoriteCount: number;
  firstImage: null;
  images: [];
  createdAt: string;
  updatedAt: string;
};

const MOCK_ACCESS_TOKEN = "mock-my-listings-access-token";
const MOCK_EMAIL = "web-e2e-my-listings-seller@babyloop.test";
const MOCK_LISTING_ID = "web-e2e-my-listings-reserved-1";
const MOCK_LISTING_TITLE = "Web E2E ilan yönetimi rezerve ürünü";

test.describe("my listings flow", () => {
  test("seller can see own reserved listing in listing management", async ({ page }) => {
    test.skip(
      !FULL_FLOW_ENABLED,
      "Set WEB_E2E_FULL_FLOW=1 and run the API + web app before this full-flow E2E.",
    );
    test.setTimeout(60_000);

    const auth = buildMockAuth();
    const listing = buildMockReservedListing();

    await installAuthRefreshRoute(page, auth);
    await installAuthMeRoute(page, auth);
    await installMyListingsRoute(page, listing);

    await page.goto("/my-listings", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/my-listings/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "İlanlarım", exact: true })).toBeVisible({
      timeout: 15_000,
    });

    const listingCard = page.locator(`article[data-listing-id="${MOCK_LISTING_ID}"]`);

    await expect(listingCard).toBeVisible({ timeout: 15_000 });
    await expect(listingCard).toHaveAttribute("data-listing-status", "reserved");
    await expect(listingCard.locator('[data-listing-status-label="reserved"]')).toBeVisible();
    await expect(listingCard).toContainText(MOCK_LISTING_TITLE);
    await expect(listingCard).toContainText(/6500(?:\.00)? TRY/);
    await expect(listingCard).toContainText("Favori: 3");

    await page.locator('nav[aria-label="İlan durumu"] [data-status-filter="reserved"]').click();
    await expect(listingCard).toBeVisible({ timeout: 15_000 });

    await page.locator('nav[aria-label="İlan durumu"] [data-status-filter="active"]').click();
    await expect(listingCard).toHaveCount(0);
    await expect(page.getByText("Bu durumda ilan yok", { exact: true })).toBeVisible();

    await expectNoMyListingsSensitiveLeak(page);
  });
});

function buildMockAuth(): AuthPayload {
  return {
    accessToken: MOCK_ACCESS_TOKEN,
    user: {
      id: "web-e2e-my-listings-user-1",
      email: MOCK_EMAIL,
      role: "user",
      emailVerifiedAt: new Date().toISOString(),
    },
    profile: {
      id: "web-e2e-my-listings-profile-1",
      displayName: "Web E2E Listing Owner",
      locationCity: "İstanbul",
    },
  };
}

function buildMockReservedListing(): MockListingSummary {
  return {
    id: MOCK_LISTING_ID,
    title: MOCK_LISTING_TITLE,
    description: "Web E2E ilan yönetimi testi için mock reserved listing.",
    status: "reserved",
    category: {
      id: "web-e2e-category-strollers",
      name: "Bebek Arabası & Seyahat",
      slug: "bebek-arabasi-seyahat",
    },
    price: {
      amount: "6500.00",
      currency: "TRY",
    },
    condition: "good",
    listingType: "sale",
    favoriteCount: 3,
    firstImage: null,
    images: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function installAuthMeRoute(page: Page, auth: AuthPayload): Promise<void> {
  await page.route("**/api/v1/auth/me", async (route) => {
    const method = route.request().method().toUpperCase();

    if (method === "OPTIONS") {
      await route.fulfill({
        status: 204,
        headers: getCorsHeaders(route),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: getCorsHeaders(route),
      body: JSON.stringify({
        ok: true,
        data: {
          user: auth.user,
          profile: auth.profile,
        },
      }),
    });
  });
}

async function installMyListingsRoute(page: Page, listing: MockListingSummary): Promise<void> {
  await page.route("**/api/v1/me/listings", async (route) => {
    const method = route.request().method().toUpperCase();

    if (method === "OPTIONS") {
      await route.fulfill({
        status: 204,
        headers: getCorsHeaders(route),
      });
      return;
    }

    expect(method).toBe("GET");

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: getCorsHeaders(route),
      body: JSON.stringify({
        ok: true,
        data: {
          listings: [listing],
        },
      } satisfies ApiResponse<MockMyListingsPayload>),
    });
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

async function expectNoMyListingsSensitiveLeak(page: Page): Promise<void> {
  const body = page.locator("body");

  await expect(body).not.toContainText(MOCK_EMAIL);
  await expect(body).not.toContainText(MOCK_ACCESS_TOKEN);
  await expect(body).not.toContainText("accessToken");
  await expect(body).not.toContainText("refreshToken");
}
