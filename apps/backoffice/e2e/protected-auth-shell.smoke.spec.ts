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

const protectedRoutes: ProtectedRoute[] = [
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

test.describe("backoffice protected auth shell", () => {
  test("guest sees sign-in required state on protected backoffice routes", async ({ page }) => {
    await installBackofficeAuthMocks(page, null);

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

async function installBackofficeAuthMocks(page: Page, auth: BackofficeAuth | null): Promise<void> {
  await page.route("**/auth/backoffice/me**", async (route) => {
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

  await page.route("**/auth/backoffice/csrf**", async (route) => {
    await fulfillJson(route, {
      ok: true,
      data: {
        csrfToken: "backoffice-auth-shell-e2e-csrf",
      },
    });
  });
}

async function installProtectedRouteDataMocks(page: Page): Promise<void> {
  await page.route("**/admin/listings**", async (route) => {
    if (await fulfillOptions(route)) {
      return;
    }

    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "GET" && pathEndsWith(url, "/admin/listings")) {
      await fulfillJson(route, {
        ok: true,
        data: {
          listings: [],
        },
      });
      return;
    }

    await fulfillUnhandled(route);
  });

  await page.route("**/admin/moderation/cases**", async (route) => {
    if (await fulfillOptions(route)) {
      return;
    }

    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "GET" && pathEndsWith(url, "/admin/moderation/cases")) {
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

    await fulfillUnhandled(route);
  });

  await page.route("**/admin/profiles**", async (route) => {
    if (await fulfillOptions(route)) {
      return;
    }

    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "GET" && pathEndsWith(url, "/admin/profiles")) {
      await fulfillJson(route, {
        ok: true,
        data: {
          profiles: [],
        },
      });
      return;
    }

    await fulfillUnhandled(route);
  });

  await page.route("**/admin/audit/events**", async (route) => {
    if (await fulfillOptions(route)) {
      return;
    }

    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "GET" && pathEndsWith(url, "/admin/audit/events")) {
      await fulfillJson(route, {
        ok: true,
        data: {
          events: [],
        },
      });
      return;
    }

    await fulfillUnhandled(route);
  });

  await page.route("**/admin/ai-ops/summary**", async (route) => {
    if (await fulfillOptions(route)) {
      return;
    }

    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "GET" && pathEndsWith(url, "/admin/ai-ops/summary")) {
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

    await fulfillUnhandled(route);
  });

  await page.route("**/admin/ai-ops/runs**", async (route) => {
    if (await fulfillOptions(route)) {
      return;
    }

    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "GET" && pathEndsWith(url, "/admin/ai-ops/runs")) {
      await fulfillJson(route, {
        ok: true,
        data: {
          runs: [],
        },
      });
      return;
    }

    await fulfillUnhandled(route);
  });
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
