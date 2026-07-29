import { expect, test, type Page, type Route } from "@playwright/test";
import {
  FULL_FLOW_ENABLED,
  type ApiResponse,
  type AuthPayload,
} from "./helpers/web-e2e-api";

type SellerDashboardSummary = {
  totals: {
    totalListings: number;
    activeListings: number;
    reservedListings: number;
    soldListings: number;
    archivedListings: number;
    totalFavorites: number;
    listingDetailViews: number;
    listingClicks: number;
    contactSellerIntents: number;
  };
  listings: Array<{
    listingId: string;
    title: string;
    status: "active" | "reserved" | "sold" | "archived";
    categoryName: string;
    categorySlug: string;
    createdAt: string;
    favoriteCount: number;
    detailViews: number;
    listingClicks: number;
    contactSellerIntents: number;
  }>;
};

type SellerDashboardMockState = {
  dashboardRequests: Array<{
    authorization: string | null;
  }>;
  summary: SellerDashboardSummary;
};

const MOCK_ACCESS_TOKEN = "mock-seller-dashboard-access-token";
const MOCK_EMAIL = "web-e2e-seller-dashboard-seller@babyloop.test";
const RAW_BUYER_EMAIL = "raw-buyer-seller-dashboard@babyloop.test";
const RAW_BUYER_PROFILE_ID = "raw-buyer-profile-seller-dashboard";
const RAW_MESSAGE_BODY = "RAW_MESSAGE_BODY_SELLER_DASHBOARD_E2E_SHOULD_NOT_RENDER";
const RAW_REFRESH_TOKEN = "RAW_REFRESH_TOKEN_SELLER_DASHBOARD_E2E_SHOULD_NOT_RENDER";
const TOP_LISTING_ID = "seller-dashboard-e2e-active-top";
const LOWER_LISTING_ID = "seller-dashboard-e2e-reserved-lower";

test.describe("seller dashboard flow", () => {
  test("seller can inspect aggregate dashboard metrics without buyer identity leaks", async ({ page }) => {
    test.skip(
      !FULL_FLOW_ENABLED,
      "Set WEB_E2E_FULL_FLOW=1 and run the API + web app before this full-flow E2E.",
    );
    test.setTimeout(60_000);

    const auth = buildMockAuth();
    const state = buildSellerDashboardState();

    await installSellerDashboardRoutes(page, auth, state);

    await page.goto("/account/seller", { waitUntil: "domcontentloaded" });

    const visibleSellerDashboards = page.locator(
      '[aria-label="Satıcı paneli"]:visible',
    );

    await expect(visibleSellerDashboards).toHaveCount(1);

    const sellerDashboard = visibleSellerDashboards.first();

    await expect(page).toHaveURL(/\/account\/seller$/, { timeout: 15_000 });
    await expect(sellerDashboard.getByRole("heading", { name: "Satıcı paneli", exact: true })).toBeVisible({
      timeout: 15_000,
    });
    const sellerDashboardIntro = sellerDashboard
      .locator("p:visible")
      .filter({
        hasText: "İlanlarını ve temel satıcı sinyallerini takip et.",
      });

    await expect(sellerDashboardIntro).toHaveCount(1);
    await expect(sellerDashboardIntro).toBeVisible();
    await expect(sellerDashboard.getByRole("button", { name: "Özet", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(sellerDashboard.getByRole("button", { name: "İlan performansı", exact: true })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await expect(sellerDashboard.getByRole("link", { name: "İlan ver", exact: true })).toHaveAttribute(
      "href",
      "/sell",
    );

    const summaryRegion = sellerDashboard.getByLabel("Satıcı özeti");

    await expect(summaryRegion).toBeVisible({ timeout: 15_000 });
    await expectMetricCard(summaryRegion, "Aktif ilan", "2");
    await expectMetricCard(summaryRegion, "İletişim talebi", "4");
    await expectMetricCard(summaryRegion, "Toplam favori", "8");
    await expectMetricCard(summaryRegion, "Satıldı / rezerve", "2");

    expect(state.dashboardRequests).toEqual([
      {
        authorization: `Bearer ${MOCK_ACCESS_TOKEN}`,
      },
    ]);

    await expectNoSellerDashboardSensitiveLeak(page);

    await sellerDashboard.getByRole("button", { name: "İlan performansı", exact: true }).click();

    const performanceRegion = sellerDashboard.getByLabel("İlan performansı");

    await expect(performanceRegion).toBeVisible({ timeout: 15_000 });

    const topListingCard = performanceRegion.locator("article").filter({
      has: page.getByRole("heading", { name: "Çok favorilenen travel sistem", exact: true }),
    });
    const lowerListingCard = performanceRegion.locator("article").filter({
      has: page.getByRole("heading", { name: "Rezerve oto koltuğu", exact: true }),
    });

    await expect(topListingCard).toBeVisible();
    await expect(lowerListingCard).toBeVisible();

    await expect(performanceRegion.locator("article").first()).toContainText("Çok favorilenen travel sistem");

    await expect(topListingCard).toContainText("Bebek Arabası & Seyahat");
    await expect(topListingCard).toContainText("Aktif");
    await expect(topListingCard).toContainText("Favori");
    await expect(topListingCard).toContainText("6");
    await expect(topListingCard).toContainText("Detay görüntüleme");
    await expect(topListingCard).toContainText("18");
    await expect(topListingCard).toContainText("Tıklama");
    await expect(topListingCard).toContainText("12");
    await expect(topListingCard).toContainText("İletişim talebi");
    await expect(topListingCard).toContainText("3");
    await expect(topListingCard.getByRole("link", { name: "Yönet", exact: true })).toHaveAttribute(
      "href",
      "/my-listings",
    );
    await expect(topListingCard.getByRole("link", { name: "Detay", exact: true })).toHaveAttribute(
      "href",
      `/listings/${TOP_LISTING_ID}`,
    );

    await expect(lowerListingCard).toContainText("Rezerve");

    await expectNoSellerDashboardSensitiveLeak(page);
  });
});

function buildMockAuth(): AuthPayload {
  return {
    accessToken: MOCK_ACCESS_TOKEN,
    user: {
      id: "web-e2e-seller-dashboard-user",
      email: MOCK_EMAIL,
      role: "user",
      emailVerifiedAt: new Date().toISOString(),
    },
    profile: {
      id: "web-e2e-seller-dashboard-profile",
      displayName: "Web E2E Seller Dashboard Owner",
      locationCity: "İstanbul",
    },
  };
}

function buildSellerDashboardState(): SellerDashboardMockState {
  return {
    dashboardRequests: [],
    summary: {
      totals: {
        totalListings: 5,
        activeListings: 2,
        reservedListings: 1,
        soldListings: 1,
        archivedListings: 1,
        totalFavorites: 8,
        listingDetailViews: 24,
        listingClicks: 17,
        contactSellerIntents: 4,
      },
      listings: [
        {
          listingId: LOWER_LISTING_ID,
          title: "Rezerve oto koltuğu",
          status: "reserved",
          categoryName: "Oto Koltuğu & Güvenlik",
          categorySlug: "oto-koltugu-guvenlik",
          createdAt: "2026-06-27T12:00:00.000Z",
          favoriteCount: 2,
          detailViews: 6,
          listingClicks: 5,
          contactSellerIntents: 1,
        },
        {
          listingId: TOP_LISTING_ID,
          title: "Çok favorilenen travel sistem",
          status: "active",
          categoryName: "Bebek Arabası & Seyahat",
          categorySlug: "bebek-arabasi-seyahat",
          createdAt: "2026-06-28T12:00:00.000Z",
          favoriteCount: 6,
          detailViews: 18,
          listingClicks: 12,
          contactSellerIntents: 3,
        },
      ],
    },
  };
}

async function installSellerDashboardRoutes(
  page: Page,
  auth: AuthPayload,
  state: SellerDashboardMockState,
): Promise<void> {
  await page.route("**/api/v1/**", async (route) => {
    if (await fulfillOptions(route)) {
      return;
    }

    const request = route.request();
    const url = new URL(request.url());
    const method = request.method().toUpperCase();

    if (method === "POST" && pathEndsWith(url, "/api/v1/auth/refresh")) {
      await fulfillJson(route, {
        ok: true,
        data: auth,
      });
      return;
    }

    if (method === "GET" && pathEndsWith(url, "/api/v1/auth/me")) {
      await fulfillJson(route, {
        ok: true,
        data: {
          user: auth.user,
          profile: auth.profile,
        },
      });
      return;
    }

    if (method === "GET" && pathEndsWith(url, "/api/v1/notifications/unread-count")) {
      await fulfillJson(route, {
        ok: true,
        data: {
          count: 0,
        },
      });
      return;
    }

    if (method === "GET" && pathEndsWith(url, "/api/v1/seller/dashboard")) {
      state.dashboardRequests.push({
        authorization: request.headers().authorization ?? null,
      });

      await fulfillJson(route, {
        ok: true,
        data: {
          summary: state.summary,
          // Deliberately unsafe fields: the page must only render aggregate seller metrics.
          buyerEmail: RAW_BUYER_EMAIL,
          buyerProfileId: RAW_BUYER_PROFILE_ID,
          rawMessageBody: RAW_MESSAGE_BODY,
          refreshToken: RAW_REFRESH_TOKEN,
        },
      });
      return;
    }

    await fulfillJson(
      route,
      {
        ok: false,
        error: {
          code: "WEB_E2E_UNHANDLED_SELLER_DASHBOARD_ROUTE",
          message: `Unhandled seller dashboard E2E route: ${method} ${url.pathname}`,
        },
      },
      500,
    );
  });
}

async function expectMetricCard(region: ReturnType<Page["getByLabel"]>, label: string, value: string): Promise<void> {
  const metricCard = region.locator("article").filter({
    hasText: label,
  });

  await expect(metricCard).toBeVisible();
  await expect(metricCard.locator("strong")).toHaveText(value);
}

async function expectNoSellerDashboardSensitiveLeak(page: Page): Promise<void> {
  const body = page.locator("body");

  await expect(body).not.toContainText(MOCK_EMAIL);
  await expect(body).not.toContainText(MOCK_ACCESS_TOKEN);
  await expect(body).not.toContainText(RAW_BUYER_EMAIL);
  await expect(body).not.toContainText(RAW_BUYER_PROFILE_ID);
  await expect(body).not.toContainText(RAW_MESSAGE_BODY);
  await expect(body).not.toContainText(RAW_REFRESH_TOKEN);
  await expect(body).not.toContainText("accessToken");
  await expect(body).not.toContainText("refreshToken");
  await expect(body).not.toContainText("buyerEmail");
  await expect(body).not.toContainText("buyerProfileId");
  await expect(body).not.toContainText("rawMessageBody");
  await expect(body).not.toContainText("WEB_E2E_UNHANDLED_SELLER_DASHBOARD_ROUTE");
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

async function fulfillJson<TData>(
  route: Route,
  body: ApiResponse<TData>,
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

function pathEndsWith(url: URL, suffix: string): boolean {
  return url.pathname === suffix || url.pathname.endsWith(suffix);
}
