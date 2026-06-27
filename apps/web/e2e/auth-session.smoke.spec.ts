import { expect, request, test, type APIRequestContext } from "@playwright/test";

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

type AuthPayload = {
  accessToken: string;
  devEmailVerificationToken?: string;
};

const API_BASE_URL =
  process.env.WEB_E2E_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:4000";

const FULL_FLOW_ENABLED = process.env.WEB_E2E_FULL_FLOW === "1";

test.describe("auth session flow", () => {
  test("user can login from UI and logout from account menu", async ({ page }) => {
    test.skip(
      !FULL_FLOW_ENABLED,
      "Set WEB_E2E_FULL_FLOW=1 and run the API + web app before this full-flow E2E.",
    );
    test.setTimeout(60_000);

    const api = await request.newContext({
      baseURL: API_BASE_URL,
      extraHTTPHeaders: {
        "content-type": "application/json",
      },
    });

    try {
      await assertApiIsAvailable(api);
      const displayName = "Web E2E Auth User";
      const email = `web-e2e-auth-${Date.now()}@babyloop.test`;
      const password = "Password12345!";

      await createVerifiedUser(api, {
        displayName,
        email,
        locationCity: "İstanbul",
        password,
      });

      await page.goto("/login", { waitUntil: "domcontentloaded" });

      const loginForm = page.locator("form.auth-form-polished");
      await expect(loginForm).toBeVisible();

      await loginForm.locator('input[name="email"]').fill(email);
      await loginForm.locator('input[name="password"]').fill(password);

      const loginResponsePromise = page.waitForResponse((response) => {
        return response.url().includes("/api/v1/auth/login") && response.request().method() === "POST";
      });

      await loginForm.getByRole("button", { name: "Giriş yap" }).click();

      const loginResponse = await loginResponsePromise;
      expect(loginResponse.ok(), await safeResponseText(loginResponse)).toBe(true);

      await expect(page).toHaveURL(/\/browse/, { timeout: 15_000 });

      const accountTrigger = () => page.locator(".market-account-trigger").filter({ hasText: displayName });
      await expect(accountTrigger()).toBeVisible({ timeout: 15_000 });

      await page.goto("/my-listings");
      await expect(page).toHaveURL(/\/my-listings/, { timeout: 15_000 });
      await expect(page.getByRole("main")).toBeVisible();
      await expect(accountTrigger()).toBeVisible({ timeout: 15_000 });

      await accountTrigger().click();

      const accountMenu = page.locator(".market-account-menu");
      await expect(accountMenu).toBeVisible();

      await accountMenu.getByRole("button", { name: "Çıkış yap" }).click();

      await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
      await expect(page.locator(".market-login-button")).toBeVisible({ timeout: 15_000 });
      await expect(page.locator(".market-account-trigger")).toHaveCount(0);
    } finally {
      await api.dispose();
    }
  });
});

async function assertApiIsAvailable(api: APIRequestContext): Promise<void> {
  try {
    const response = await api.get("/health");
    expect(response.ok(), await safeResponseText(response)).toBe(true);
  } catch (error) {
    throw new Error(
      `BabyLoop API is not reachable at ${API_BASE_URL}. Start the API/web dev stack first or set WEB_E2E_API_BASE_URL=http://127.0.0.1:4000. ${String(error)}`,
    );
  }
}

async function createVerifiedUser(
  api: APIRequestContext,
  input: {
    displayName: string;
    email: string;
    locationCity: string;
    password: string;
  },
): Promise<void> {
  const registerResponse = await api.post("/api/v1/auth/register", {
    data: input,
  });

  expect(registerResponse.ok(), await safeResponseText(registerResponse)).toBe(true);

  const registerBody = (await registerResponse.json()) as ApiResponse<AuthPayload>;
  expect(registerBody.ok).toBe(true);

  if (!registerBody.ok) {
    return;
  }

  if (!registerBody.data.devEmailVerificationToken) {
    return;
  }

  const verificationResponse = await api.post("/api/v1/auth/email-verification/confirm", {
    data: {
      token: registerBody.data.devEmailVerificationToken,
    },
  });

  expect(verificationResponse.ok(), await safeResponseText(verificationResponse)).toBe(true);

  const verificationBody = (await verificationResponse.json()) as ApiResponse<{
    emailVerified: true;
  }>;
  expect(verificationBody.ok).toBe(true);
}

async function safeResponseText(response: { text: () => Promise<string> }): Promise<string> {
  const text = await response.text();

  return text
    .replace(/accessToken":"[^"]+"/g, 'accessToken":"[redacted]"')
    .replace(/refreshToken":"[^"]+"/g, 'refreshToken":"[redacted]"')
    .replace(/password":"[^"]+"/g, 'password":"[redacted]"')
    .slice(0, 500);
}
