import { expect, test, type Page, type Route } from "@playwright/test";

const PROTECTED_PUBLIC_PATHS = [
  "/favorites",
  "/my-listings",
  "/notifications",
  "/account/profile",
  "/account/password",
  "/account/saved-searches",
  "/account/seller",
  "/conversations",
] as const;

test.describe("protected public routes", () => {
  test("guest user is redirected away from protected marketplace pages", async ({ page }) => {
    test.setTimeout(45_000);

    await installGuestAuthRoutes(page);

    for (const protectedPath of PROTECTED_PUBLIC_PATHS) {
      await page.goto(protectedPath, { waitUntil: "domcontentloaded" });

      await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
      await expect(page.locator(".market-login-button")).toBeVisible({ timeout: 15_000 });
      await expect(page.locator(".market-account-trigger")).toHaveCount(0);
    }

    await expectNoProtectedRouteSensitiveLeak(page);
  });
});

async function installGuestAuthRoutes(page: Page): Promise<void> {
  await page.route("**/api/v1/**", async (route) => {
    if (await fulfillOptions(route)) {
      return;
    }

    const request = route.request();
    const url = new URL(request.url());
    const method = request.method().toUpperCase();

    if (method === "GET" && pathEndsWith(url, "/api/v1/auth/csrf")) {
      await fulfillJson(route, {
        ok: true,
        data: {
          csrfToken: "protected-routes-guest-e2e-csrf",
        },
      });
      return;
    }

    if (
      (method === "POST" && pathEndsWith(url, "/api/v1/auth/refresh")) ||
      (method === "GET" && pathEndsWith(url, "/api/v1/auth/me"))
    ) {
      await fulfillJson(
        route,
        {
          ok: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Guest user is not authenticated.",
          },
        },
        401,
      );
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

    await fulfillJson(
      route,
      {
        ok: false,
        error: {
          code: "WEB_E2E_GUEST_ROUTE_BLOCKED",
          message: `Protected routes E2E blocked guest API route: ${method} ${url.pathname}`,
        },
      },
      401,
    );
  });
}

async function expectNoProtectedRouteSensitiveLeak(page: Page): Promise<void> {
  const body = page.locator("body");

  await expect(body).not.toContainText("accessToken");
  await expect(body).not.toContainText("refreshToken");
  await expect(body).not.toContainText("Password12345!");
  await expect(body).not.toContainText("WEB_E2E_GUEST_ROUTE_BLOCKED");
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
  response:
    | {
        ok: true;
        data: unknown;
      }
    | {
        ok: false;
        error: {
          code: string;
          message: string;
        };
      },
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
