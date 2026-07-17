import { expect, test, type Page, type Route } from "@playwright/test";

type ApiResponse<TData> =
  | {
      ok: true;
      data: TData;
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
      };
    };

type BackofficeAuthRole = "admin" | "user";

type BackofficeAuth = {
  user: {
    id: string;
    email: string;
    role: BackofficeAuthRole;
    emailVerifiedAt: string;
    profileId: string;
    displayName: string;
    locationCity: string | null;
  };
};

type ProtectedRoute = {
  path: string;
  heading: string;
};

type FailureRoute = ProtectedRoute & {
  failingPathname: string;
};

const protectedRoutes: ProtectedRoute[] = [
  {
    path: "/",
    heading: "Trust & Safety monitoring dashboard",
  },
  {
    path: "/listings",
    heading: "Listings",
  },
  {
    path: "/moderation",
    heading: "Moderation cases",
  },
  {
    path: "/profiles",
    heading: "Profiles",
  },
  {
    path: "/audit",
    heading: "Audit events",
  },
  {
    path: "/ai-ops",
    heading: "AI operations health",
  },
  {
    path: "/conversations",
    heading: "Messages",
  },
];

const failureRoutes: FailureRoute[] = [
  {
    path: "/",
    heading: "Trust & Safety monitoring dashboard",
    failingPathname: "/admin/dashboard/summary",
  },
  {
    path: "/listings",
    heading: "Listings",
    failingPathname: "/admin/listings",
  },
  {
    path: "/moderation",
    heading: "Moderation cases",
    failingPathname: "/admin/moderation/cases",
  },
  {
    path: "/profiles",
    heading: "Profiles",
    failingPathname: "/admin/profiles",
  },
  {
    path: "/audit",
    heading: "Audit events",
    failingPathname: "/admin/audit/events",
  },
  {
    path: "/ai-ops",
    heading: "AI operations health",
    failingPathname: "/admin/ai-ops/summary",
  },
  {
    path: "/conversations",
    heading: "Messages",
    failingPathname: "/admin/conversations",
  },
];

const ADMIN_AUTH: BackofficeAuth = {
  user: {
    id: "admin-auth-shell-e2e",
    email: "admin-auth-shell-e2e@babyloop.test",
    role: "admin",
    emailVerifiedAt: "2026-01-01T00:00:00.000Z",
    profileId: "admin-profile-auth-shell-e2e",
    displayName: "Backoffice Auth Shell Admin",
    locationCity: "İstanbul",
  },
};

const NON_ADMIN_AUTH: BackofficeAuth = {
  user: {
    id: "user-auth-shell-e2e",
    email: "user-auth-shell-e2e@babyloop.test",
    role: "user",
    emailVerifiedAt: "2026-01-01T00:00:00.000Z",
    profileId: "user-profile-auth-shell-e2e",
    displayName: "Backoffice Auth Shell User",
    locationCity: "İstanbul",
  },
};

const NEGATIVE_UI_ERROR_MESSAGE = "Backoffice negative UI failure.";
const RAW_EMAIL_SENTINEL = "raw-backoffice-negative-ui-parent@example.test";
const RAW_PHONE_SENTINEL = "+905551112233";
const RAW_TOKEN_SENTINEL = "sk-backoffice-negative-ui-secret-token";
const RAW_MESSAGE_SENTINEL = "RAW_BACKOFFICE_NEGATIVE_UI_MESSAGE_BODY";

test.describe("backoffice protected auth shell", () => {
  test("guest sees sign-in required state on protected backoffice routes", async ({ page }) => {
    const authRequests = await installBackofficeAuthMocks(page, null);

    for (const route of protectedRoutes) {
      await page.goto(route.path, { waitUntil: "domcontentloaded" });

      await expect(page.getByRole("heading", { name: "Sign in required", exact: true })).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByText("Backoffice access required", { exact: true })).toBeVisible();
      await expect(
        page.getByText("You need to sign in before accessing BabyLoop Backoffice.", { exact: true }),
      ).toBeVisible();
      await expect(page.getByRole("link", { name: "Sign in", exact: true })).toHaveAttribute(
        "href",
        "/login",
      );

      await expect(page.getByRole("heading", { name: route.heading, exact: true })).toHaveCount(0);
    }

    expect(authRequests.csrf).toBe(0);
    expect(authRequests.me).toBeGreaterThan(0);
    expect(authRequests.refresh).toBeLessThanOrEqual(authRequests.me);
  });

  test("non-admin user sees forbidden state on protected backoffice routes", async ({ page }) => {
    await installBackofficeAuthMocks(page, NON_ADMIN_AUTH);

    for (const route of protectedRoutes) {
      await page.goto(route.path, { waitUntil: "domcontentloaded" });

      await expect(
        page.getByRole("heading", {
          name: "You do not have backoffice access",
          exact: true,
        }),
      ).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText("Access denied", { exact: true })).toBeVisible();
      await expect(page.getByText("Current role:")).toBeVisible();
      await expect(page.locator(".auth-state-card").getByText("user", { exact: true })).toBeVisible();

      await expect(page.getByRole("heading", { name: route.heading, exact: true })).toHaveCount(0);
    }
  });

  test("auth check failure shows retry state and recovers to authorized shell", async ({ page }) => {
    await installBackofficeAuthRetryMocks(page);
    await installProtectedRouteDataMocks(page);

    await page.goto("/listings", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Access check failed", exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Could not verify your backoffice session. Try again.", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Listings", exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "Retry", exact: true }).click();

    await expectBackofficeShell(page);
    await expect(page.getByRole("heading", { name: "Listings", exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("heading", { name: "Access check failed", exact: true })).toHaveCount(0);
  });

  test("admin can open protected backoffice route shells", async ({ page }) => {
    await installBackofficeAuthMocks(page, ADMIN_AUTH);
    await installProtectedRouteDataMocks(page);

    for (const route of protectedRoutes) {
      await page.goto(route.path, { waitUntil: "domcontentloaded" });

      await expectBackofficeShell(page);
      await expect(page.getByRole("heading", { name: route.heading, exact: true })).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByRole("heading", { name: "Sign in required", exact: true })).toHaveCount(0);
      await expect(
        page.getByRole("heading", {
          name: "You do not have backoffice access",
          exact: true,
        }),
      ).toHaveCount(0);
    }
  });

  test("admin sees safe route-level API failure states without raw private data", async ({ page }) => {
    const mockState = {
      failingPathname: null as string | null,
    };

    await installBackofficeAuthMocks(page, ADMIN_AUTH);
    await installProtectedRouteDataMocks(page, {
      getFailingPathname: () => mockState.failingPathname,
    });

    for (const route of failureRoutes) {
      mockState.failingPathname = route.failingPathname;

      await page.goto(route.path, { waitUntil: "domcontentloaded" });

      await expectBackofficeShell(page);
      await expect(page.getByRole("heading", { name: route.heading, exact: true })).toBeVisible({
        timeout: 15_000,
      });

      const alert = page.getByRole("alert").filter({
        hasText: NEGATIVE_UI_ERROR_MESSAGE,
      });
      await expect(alert).toBeVisible({ timeout: 15_000 });
      await expect(alert).toContainText(NEGATIVE_UI_ERROR_MESSAGE);

      await expectNoNegativeUiPrivateLeak(page);
    }
  });
});

async function expectBackofficeShell(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "Backoffice", exact: true })).toBeVisible();
  await expect(page.getByText("Operations Console", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Backoffice status")).toHaveText("Foundation ready");

  const navigation = page.getByRole("complementary", { name: "Backoffice navigation" });

  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole("link", { name: /Dashboard/ })).toHaveAttribute("href", "/");
  await expect(navigation.getByRole("link", { name: /Moderation/ })).toHaveAttribute(
    "href",
    "/moderation",
  );
  await expect(navigation.getByRole("link", { name: /Listings/ })).toHaveAttribute(
    "href",
    "/listings",
  );
  await expect(navigation.getByRole("link", { name: /Profiles/ })).toHaveAttribute(
    "href",
    "/profiles",
  );
  await expect(navigation.getByRole("link", { name: /AI Tools/ })).toHaveAttribute(
    "href",
    "/ai-ops",
  );
}

async function installBackofficeAuthMocks(
  page: Page,
  auth: BackofficeAuth | null,
): Promise<{ csrf: number; me: number; refresh: number }> {
  const requests = {
    csrf: 0,
    me: 0,
    refresh: 0,
  };

  await page.route("**/auth/backoffice/me**", async (route) => {
    requests.me += 1;

    if (!auth) {
      await fulfillJson(
        route,
        {
          ok: false,
          error: {
            code: "UNAUTHENTICATED",
            message: "Backoffice authentication is required.",
          },
        },
        401,
      );
      return;
    }

    await fulfillJson(route, {
      ok: true,
      data: auth,
    });
  });

  await page.route("**/auth/backoffice/refresh**", async (route) => {
    requests.refresh += 1;

    if (!auth) {
      await fulfillJson(
        route,
        {
          ok: false,
          error: {
            code: "UNAUTHENTICATED",
            message: "Backoffice refresh session is required.",
          },
        },
        401,
      );
      return;
    }

    await fulfillJson(route, {
      ok: true,
      data: auth,
    });
  });

  await installBackofficeCsrfMock(page, requests);

  return requests;
}

async function installBackofficeAuthRetryMocks(page: Page): Promise<void> {
  let meRequestCount = 0;

  await page.route("**/auth/backoffice/me**", async (route) => {
    meRequestCount += 1;

    if (meRequestCount === 1) {
      await route.abort("failed");
      return;
    }

    await fulfillJson(route, {
      ok: true,
      data: ADMIN_AUTH,
    });
  });

  await page.route("**/auth/backoffice/refresh**", async (route) => {
    await fulfillJson(route, {
      ok: true,
      data: ADMIN_AUTH,
    });
  });

  await installBackofficeCsrfMock(page);
}

async function installBackofficeCsrfMock(
  page: Page,
  requests?: { csrf: number },
): Promise<void> {
  await page.route("**/auth/backoffice/csrf**", async (route) => {
    if (requests) {
      requests.csrf += 1;
    }

    await fulfillJson(route, {
      ok: true,
      data: {
        csrfToken: "backoffice-auth-shell-e2e-csrf",
      },
    });
  });
}

async function installProtectedRouteDataMocks(
  page: Page,
  options?: {
    getFailingPathname?: () => string | null;
  },
): Promise<void> {
  await page.route("**/admin/**", async (route) => {
    if (await fulfillOptions(route)) {
      return;
    }

    const request = route.request();
    const url = new URL(request.url());
    const method = request.method().toUpperCase();
    const failingPathname = options?.getFailingPathname?.() ?? null;

    if (failingPathname && method === "GET" && pathEndsWith(url, failingPathname)) {
      await fulfillNegativeUiFailure(route);
      return;
    }

    if (method === "GET" && pathEndsWith(url, "/admin/dashboard/summary")) {
      await fulfillJson(route, {
        ok: true,
        data: {
          summary: createDashboardSummary(),
        },
      });
      return;
    }

    if (method === "GET" && pathEndsWith(url, "/admin/listings")) {
      await fulfillJson(route, {
        ok: true,
        data: {
          listings: [],
        },
      });
      return;
    }

    if (method === "GET" && pathEndsWith(url, "/admin/moderation/cases")) {
      await fulfillJson(route, {
        ok: true,
        data: {
          cases: [],
          summary: {
            total: 0,
            byStatus: {
              pending: 0,
              inReview: 0,
              resolved: 0,
              dismissed: 0,
            },
            byTargetType: {
              listing: 0,
              profile: 0,
              message: 0,
            },
          },
        },
      });
      return;
    }

    if (method === "GET" && pathEndsWith(url, "/admin/profiles")) {
      await fulfillJson(route, {
        ok: true,
        data: {
          profiles: [],
        },
      });
      return;
    }

    if (method === "GET" && pathEndsWith(url, "/admin/audit/events")) {
      await fulfillJson(route, {
        ok: true,
        data: {
          events: [],
        },
      });
      return;
    }

    if (method === "GET" && pathEndsWith(url, "/admin/ai-ops/summary")) {
      await fulfillJson(route, {
        ok: true,
        data: {
          summary: {
            totals: {
              totalRuns: 0,
              runsLast24Hours: 0,
              runsLast7Days: 0,
              successRunsLast7Days: 0,
              failedRunsLast7Days: 0,
              providerFailuresLast7Days: 0,
              validationFailuresLast7Days: 0,
              skippedRunsLast7Days: 0,
            },
            statusCounts: [],
            providerModelCounts: [],
            recentRuns: [],
          },
        },
      });
      return;
    }

    if (method === "GET" && pathEndsWith(url, "/admin/ai-ops/runs")) {
      await fulfillJson(route, {
        ok: true,
        data: {
          runs: [],
        },
      });
      return;
    }

    if (method === "GET" && pathEndsWith(url, "/admin/conversations")) {
      await fulfillJson(route, {
        ok: true,
        data: {
          conversations: [],
        },
      });
      return;
    }

    await fulfillUnhandled(route);
  });
}

function createDashboardSummary() {
  return {
    listings: {
      totalListings: 0,
      activeListings: 0,
      archivedListings: 0,
      soldListings: 0,
      reservedListings: 0,
      draftListings: 0,
      listingsCreatedLast7Days: 0,
      listingsUpdatedLast7Days: 0,
      listingsWithRejectedImages: 0,
    },
    images: {
      totalListingImages: 0,
      approvedListingImages: 0,
      needsReviewListingImages: 0,
      rejectedListingImages: 0,
      imagesReviewedLast7Days: 0,
    },
    moderation: {
      totalModerationCases: 0,
      openModerationCases: 0,
      closedModerationCases: 0,
      casesCreatedLast7Days: 0,
      openHighPriorityCases: 0,
      openNormalPriorityCases: 0,
      openLowPriorityCases: 0,
      pendingReports: 0,
      reportsCreatedLast7Days: 0,
      sensitiveAccessGrantedLast7Days: 0,
      sensitiveAccessDeniedLast7Days: 0,
    },
    actions: {
      auditEventsLast7Days: 0,
      profileEnforcementActionsLast7Days: 0,
      listingActionsLast7Days: 0,
      imageReviewActionsLast7Days: 0,
      messageEnforcementActionsLast7Days: 0,
    },
    profiles: {
      restrictedProfiles: 0,
      suspendedProfiles: 0,
      highRiskProfiles: 0,
      criticalRiskProfiles: 0,
      profilesNeedingReview: 0,
    },
    conversations: {
      totalConversations: 0,
      conversationsCreatedLast7Days: 0,
      messagesCreatedLast7Days: 0,
      reportedMessageCount: 0,
      openMessageCases: 0,
    },
    ai: {
      moderationSummaryRunsLast7Days: 0,
      moderationSummaryFailuresLast7Days: 0,
      providerFailuresLast7Days: 0,
      validationFailuresLast7Days: 0,
    },
  };
}

async function fulfillNegativeUiFailure(route: Route): Promise<void> {
  await fulfillJson(
    route,
    {
      ok: false,
      error: {
        code: "BACKOFFICE_NEGATIVE_UI_FAILURE",
        message: NEGATIVE_UI_ERROR_MESSAGE,
        rawEmail: RAW_EMAIL_SENTINEL,
        rawPhone: RAW_PHONE_SENTINEL,
        accessToken: RAW_TOKEN_SENTINEL,
        refreshToken: RAW_TOKEN_SENTINEL,
        rawMessageBody: RAW_MESSAGE_SENTINEL,
      },
    } as ApiResponse<never>,
    503,
  );
}

async function expectNoNegativeUiPrivateLeak(page: Page): Promise<void> {
  const body = page.locator("body");

  await expect(body).not.toContainText(RAW_EMAIL_SENTINEL);
  await expect(body).not.toContainText(RAW_PHONE_SENTINEL);
  await expect(body).not.toContainText(RAW_TOKEN_SENTINEL);
  await expect(body).not.toContainText(RAW_MESSAGE_SENTINEL);
  await expect(body).not.toContainText("accessToken");
  await expect(body).not.toContainText("refreshToken");
  await expect(body).not.toContainText("passwordHash");
  await expect(body).not.toContainText("rawMessageBody");
  await expect(body).not.toContainText("BACKOFFICE_E2E_UNHANDLED_ROUTE");
}

function pathEndsWith(url: URL, suffix: string): boolean {
  return url.pathname === suffix || url.pathname.endsWith(suffix);
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
  response: ApiResponse<TData>,
  status = response.ok ? 200 : 400,
): Promise<void> {
  await route.fulfill({
    status,
    headers: {
      ...getCorsHeaders(route),
      "content-type": "application/json",
    },
    body: JSON.stringify(response),
  });
}

async function fulfillUnhandled(route: Route): Promise<void> {
  const request = route.request();
  const url = new URL(request.url());

  await fulfillJson(
    route,
    {
      ok: false,
      error: {
        code: "BACKOFFICE_E2E_UNHANDLED_ROUTE",
        message: `Unhandled backoffice protected auth shell route: ${request.method()} ${url.pathname}`,
      },
    },
    500,
  );
}

function getCorsHeaders(route: Route): Record<string, string> {
  const origin = route.request().headers().origin ?? "http://localhost:3001";

  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "authorization,content-type,x-babyloop-csrf-token",
  };
}
