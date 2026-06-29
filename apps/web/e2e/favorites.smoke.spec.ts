import { expect, request, test, type Page, type Route } from "@playwright/test";
import {
  API_BASE_URL,
  E2E_PASSWORD,
  FULL_FLOW_ENABLED,
  assertApiIsAvailable,
  createListing,
  createVerifiedUser,
  fetchFirstCategoryId,
  installAuthRefreshRoute,
  type AuthPayload,
} from "./helpers/web-e2e-api";

type MockFavoriteListing = {
  id: string;
  title: string;
  price: {
    amount: string;
    currency: string;
  };
  favoriteCount: number;
  status: "active" | "reserved" | "sold" | "archived";
  listingType: "sale" | "swap" | "donation";
  condition: "new" | "like_new" | "good" | "fair" | "needs_repair";
  category: {
    id: string;
    name: string;
    slug: string;
  };
  firstImage: null;
  images: [];
  createdAt: string;
  favoritedAt: string;
};

type FavoritesRouteState = {
  favorites: MockFavoriteListing[];
  postRequests: string[];
  deleteRequests: string[];
};

const MOCK_ACCESS_TOKEN = "mock-favorites-access-token";
const MOCK_BUYER_EMAIL = "web-e2e-favorites-buyer@babyloop.test";
const MOCK_BUYER_PROFILE_ID = "web-e2e-favorites-buyer-profile";

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

      const listing = await createListing(sellerApi, {
        accessToken: seller.accessToken,
        categoryId,
        title: listingTitle,
      });

      const buyer = buildMockBuyerAuth();
      const state = buildFavoritesRouteState();

      await installAuthRefreshRoute(page, buyer);
      await installAuthMeRoute(page, buyer);
      await installFavoritesRoute(page, {
        listingId: listing.id,
        listingTitle,
        state,
      });

      await page.goto(`/listings/${listing.id}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: listingTitle })).toBeVisible({
        timeout: 15_000,
      });

      const favoriteButton = page.getByRole("button", { name: "Favori", exact: true });
      await expect(favoriteButton).toBeVisible({ timeout: 15_000 });
      await expect(favoriteButton).toBeEnabled({ timeout: 15_000 });

      const addFavoriteResponsePromise = page.waitForResponse((response) => {
        return response.url().includes("/api/v1/favorites") && response.request().method() === "POST";
      });

      await favoriteButton.click();

      const addFavoriteResponse = await addFavoriteResponsePromise;
      expect(addFavoriteResponse.ok(), await addFavoriteResponse.text()).toBe(true);
      expect(state.postRequests).toEqual([listing.id]);

      await expect(page.getByRole("button", { name: "Favoriden çıkar", exact: true })).toBeVisible({
        timeout: 15_000,
      });

      await page.goto("/favorites", { waitUntil: "domcontentloaded" });

      await expect(page.getByRole("heading", { name: "Favoriler", exact: true })).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByText(listingTitle, { exact: true })).toBeVisible();

      const removeFavoriteResponsePromise = page.waitForResponse((response) => {
        return response.url().includes("/api/v1/favorites") && response.request().method() === "DELETE";
      });

      await page.getByRole("button", { name: "Favoriden çıkar" }).click();

      const removeFavoriteResponse = await removeFavoriteResponsePromise;
      expect(removeFavoriteResponse.ok(), await removeFavoriteResponse.text()).toBe(true);
      expect(state.deleteRequests).toEqual([listing.id]);

      await expect(page.getByText("Henüz favori ilan yok.")).toBeVisible({
        timeout: 15_000,
      });

      await expectNoFavoritesSensitiveLeak(page);
    } finally {
      await setupApi.dispose();
      await sellerApi.dispose();
    }
  });
});

function buildMockBuyerAuth(): AuthPayload {
  return {
    accessToken: MOCK_ACCESS_TOKEN,
    user: {
      id: "web-e2e-favorites-buyer-user",
      email: MOCK_BUYER_EMAIL,
      role: "user",
      emailVerifiedAt: new Date().toISOString(),
    },
    profile: {
      id: MOCK_BUYER_PROFILE_ID,
      displayName: "Web E2E Fav Buyer",
      locationCity: "İstanbul",
    },
  };
}

function buildFavoritesRouteState(): FavoritesRouteState {
  return {
    favorites: [],
    postRequests: [],
    deleteRequests: [],
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

async function installFavoritesRoute(
  page: Page,
  input: {
    listingId: string;
    listingTitle: string;
    state: FavoritesRouteState;
  },
): Promise<void> {
  await page.route("**/api/v1/favorites", async (route) => {
    const method = route.request().method().toUpperCase();

    if (method === "OPTIONS") {
      await route.fulfill({
        status: 204,
        headers: getCorsHeaders(route),
      });
      return;
    }

    if (method === "GET") {
      await fulfillJson(route, {
        ok: true,
        data: {
          favorites: input.state.favorites,
        },
      });
      return;
    }

    if (method === "POST") {
      const listingId = readListingId(route);
      expect(listingId).toBe(input.listingId);

      input.state.postRequests.push(listingId);

      if (!input.state.favorites.some((favorite) => favorite.id === listingId)) {
        input.state.favorites = [buildMockFavoriteListing(input)];
      }

      await fulfillJson(route, {
        ok: true,
        data: {
          favorite: {
            profileId: MOCK_BUYER_PROFILE_ID,
            listingId,
          },
          created: true,
        },
      });
      return;
    }

    expect(method).toBe("DELETE");

    const listingId = readListingId(route);
    expect(listingId).toBe(input.listingId);

    input.state.deleteRequests.push(listingId);
    input.state.favorites = input.state.favorites.filter((favorite) => favorite.id !== listingId);

    await fulfillJson(route, {
      ok: true,
      data: {
        favorite: {
          profileId: MOCK_BUYER_PROFILE_ID,
          listingId,
        },
        removed: true,
      },
    });
  });
}

function buildMockFavoriteListing(input: {
  listingId: string;
  listingTitle: string;
}): MockFavoriteListing {
  const now = new Date().toISOString();

  return {
    id: input.listingId,
    title: input.listingTitle,
    price: {
      amount: "6500.00",
      currency: "TRY",
    },
    favoriteCount: 1,
    status: "active",
    listingType: "sale",
    condition: "good",
    category: {
      id: "web-e2e-favorites-category-strollers",
      name: "Bebek Arabaları",
      slug: "bebek-arabalari",
    },
    firstImage: null,
    images: [],
    createdAt: now,
    favoritedAt: now,
  };
}

function readListingId(route: Route): string {
  const rawBody = route.request().postData();

  if (!rawBody) {
    throw new Error("Favorites request body is empty.");
  }

  const body = JSON.parse(rawBody) as {
    listingId?: unknown;
  };

  if (typeof body.listingId !== "string" || body.listingId.length === 0) {
    throw new Error("Favorites request body does not include listingId.");
  }

  return body.listingId;
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

async function expectNoFavoritesSensitiveLeak(page: Page): Promise<void> {
  const body = page.locator("body");

  await expect(body).not.toContainText(MOCK_BUYER_EMAIL);
  await expect(body).not.toContainText(MOCK_ACCESS_TOKEN);
  await expect(body).not.toContainText(E2E_PASSWORD);
  await expect(body).not.toContainText("accessToken");
  await expect(body).not.toContainText("refreshToken");
}
