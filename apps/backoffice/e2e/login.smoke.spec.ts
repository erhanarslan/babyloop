import { expect, test, type Page, type Route } from "@playwright/test";

test("backoffice login page opens", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "Giriş yap" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Google ile devam et" })).toBeVisible();
  await expect(page.getByLabel("E-posta")).toBeVisible();
  await expect(page.getByLabel("Şifre")).toBeVisible();
});

test("Google login starts once with a safe relative next path", async ({ page }) => {
  const startRequests: string[] = [];
  await page.route("**/auth/backoffice/google/start**", async (route) => {
    startRequests.push(route.request().url());
    await route.abort("aborted");
  });
  await page.goto("/login?next=%2Flistings%3Fstatus%3Dactive");

  await page.getByRole("button", { name: "Google ile devam et" }).evaluate((element) => {
    if (!(element instanceof HTMLButtonElement)) {
      throw new Error("Expected the Google login trigger to be a button.");
    }

    element.click();
    element.click();
  });

  await expect.poll(() => startRequests.length).toBe(1);
  expect(new URL(startRequests[0]!).searchParams.get("next")).toBe("/listings?status=active");
});

test("Google login drops an unsafe next path", async ({ page }) => {
  let startUrl: string | null = null;
  await page.route("**/auth/backoffice/google/start**", async (route) => {
    startUrl = route.request().url();
    await route.abort("aborted");
  });
  await page.goto("/login?next=https%3A%2F%2Fevil.example%2Fsteal");

  await page.getByRole("button", { name: "Google ile devam et" }).click();

  await expect.poll(() => startUrl).not.toBeNull();
  expect(new URL(startUrl!).searchParams.has("next")).toBe(false);
});

test("Google callback verifies a staff session without exposing callback material", async ({ page }) => {
  await installOAuthSessionMock(page, "staff", "admin");

  await page.goto("/auth/callback?status=success&next=%2Flistings&code=not-a-real-code&token=not-a-real-token");

  await expect(page).toHaveURL(/\/listings$/u);
  await expect(page.getByRole("complementary", { name: "Yönetim paneli gezintisi" })).toBeVisible();
  await expect(page.getByText("not-a-real-code")).toHaveCount(0);
  await expect(page.getByText("not-a-real-token")).toHaveCount(0);
  expect(page.url()).not.toMatch(/code=|token=/u);
});

test("Google callback keeps a normal account in preview mode", async ({ page }) => {
  await installOAuthSessionMock(page, "preview", "user");

  await page.goto("/auth/callback?status=success");

  await expect(page).toHaveURL(/\/$/u);
  await expect(page.getByRole("heading", { name: "Ürün tanıtım görünümü" })).toBeVisible();
  await expect(page.getByRole("status").getByText("Tanıtım modu · Salt okunur", { exact: true })).toBeVisible();
});

for (const [error, message] of [
  [
    "google_account_not_found",
    "Bu Google hesabı BabyLoop’ta kayıtlı değil. Önce BabyLoop üzerinden hesabını oluştur."
  ],
  ["account_disabled", "Bu hesabın girişi devre dışı bırakılmış."]
] as const) {
  test(`shows the controlled ${error} provider result`, async ({ page }) => {
    await page.goto(`/login?authError=${error}`);

    await expect(page.locator("p.form-error[role=alert]")).toHaveText(message);
  });
}

test("callback verification failure returns to a safe login error", async ({ page }) => {
  await page.route("**/auth/backoffice/me**", (route) => fulfillUnauthenticated(route));
  await page.route("**/auth/backoffice/refresh**", (route) => fulfillUnauthenticated(route));

  await page.goto("/auth/callback?status=success&next=%2Flistings");

  await expect(page).toHaveURL(/\/login\?authError=session_establishment_failed&next=%2Flistings$/u);
  await expect(page.locator("p.form-error[role=alert]")).toContainText("Backoffice oturumu oluşturulamadı");
});

async function installOAuthSessionMock(
  page: Page,
  accessMode: "preview" | "staff",
  role: "admin" | "user"
): Promise<void> {
  const auth = {
    accessMode,
    user: {
      id: `oauth-${role}`,
      email: `oauth-${role}@babyloop.test`,
      role,
      emailVerifiedAt: "2026-01-01T00:00:00.000Z",
      profileId: `oauth-${role}-profile`,
      displayName: `OAuth ${role}`,
      locationCity: "İstanbul"
    }
  };
  await page.route("**/auth/backoffice/me**", (route) => fulfillJson(route, { ok: true, data: auth }));
  await page.route("**/auth/backoffice/refresh**", (route) => fulfillJson(route, { ok: true, data: auth }));
}

async function fulfillUnauthenticated(route: Route): Promise<void> {
  await fulfillJson(route, {
    ok: false,
    error: { code: "UNAUTHENTICATED", message: "Backoffice authentication is required." }
  }, 401);
}

async function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    body: JSON.stringify(body),
    contentType: "application/json",
    status
  });
}
