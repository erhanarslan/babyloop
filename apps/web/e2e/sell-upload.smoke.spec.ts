import { expect, request, test, type APIRequestContext, type Page, type Route } from "@playwright/test";

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
  profile?: {
    id: string;
    displayName: string;
    locationCity: string | null;
  };
  user?: {
    id: string;
    email: string;
    role: "user";
    emailVerifiedAt: string | null;
  };
};

type CategoriesPayload = {
  categories: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
};

type ListingImageReviewStatus = "approved" | "needs_review" | "pending" | "rejected";

type BrowserMockOptions = {
  imageUploadStatus?: ListingImageReviewStatus;
  failImageUpload?: boolean;
};

const RAW_ACCESS_TOKEN_SENTINEL = "RAW_ACCESS_TOKEN_SELL_UPLOAD_E2E_SHOULD_NOT_RENDER";
const RAW_IMAGE_BINARY_SENTINEL = "RAW_IMAGE_BINARY_SELL_UPLOAD_E2E_SHOULD_NOT_RENDER";
const RAW_EMAIL_SENTINEL = "raw-sell-upload-e2e@babyloop.test";

const API_BASE_URL =
  process.env.WEB_E2E_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:4000";

const FULL_FLOW_ENABLED = process.env.WEB_E2E_FULL_FLOW === "1";

const TEST_IMAGE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

test.describe("sell listing upload flow", () => {
  test("authenticated seller can create a listing and upload an approved image", async ({ page }) => {
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
      await assertCategoriesExist(api);

      const email = `web-e2e-seller-${Date.now()}@babyloop.test`;
      const password = "Password12345!";

      await createVerifiedSeller(api, {
        displayName: "Web E2E Seller",
        email,
        locationCity: "İstanbul",
        password,
      });

      const listingRequests = await loginSellerInBrowser(page, api, {
        email,
        password,
      });

      await page.goto("/sell");

      await expect(page.getByRole("heading", { name: "İlan bilgileri" })).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByRole("heading", { name: "Görseller" })).toBeVisible();

      const categorySelect = page.locator('select[name="categoryId"]');
      const firstCategoryValue = await categorySelect.locator("option").first().getAttribute("value");

      test.skip(!firstCategoryValue, "The sell page has no selectable category.");

      await categorySelect.selectOption(firstCategoryValue);
      await page.locator('select[name="listingType"]').selectOption("sale");
      await page.locator('input[name="title"]').fill("Web E2E temiz bebek arabası");
      await page
        .locator('textarea[name="description"]')
        .fill("Web E2E testi için oluşturulan temiz ve güvenli bebek arabası ilanı.");
      await page.locator('input[name="priceAmount"]').fill("6500");
      await page.locator('input[name="currency"]').fill("TRY");
      await page.locator('select[name="condition"]').selectOption("good");
      await page.locator('input[name="city"]').fill("İstanbul");

      await page.locator('input[type="file"]').setInputFiles({
        name: "babyloop-e2e-product.png",
        mimeType: "image/png",
        buffer: Buffer.from(TEST_IMAGE_PNG_BASE64, "base64"),
      });

      await expect(page.getByText("babyloop-e2e-product.png")).toBeVisible();

      await page.getByRole("button", { name: "İlanı oluştur" }).click();

      await expect(page).toHaveURL(/\/listings\/[a-zA-Z0-9-]+$/, {
        timeout: 30_000,
      });
      await expect(page.getByRole("main")).toBeVisible();

      expect(listingRequests).toEqual([
        expect.objectContaining({
          condition: "good",
          currency: "TRY",
          listingType: "sale",
          priceAmount: "6500",
          title: "Web E2E temiz bebek arabası",
        }),
      ]);

      await expectNoSellUploadSensitiveLeak(page);
    } finally {
      await api.dispose();
    }

  });

  test("authenticated seller is redirected with image review notice when uploaded image needs review", async ({
    page,
  }) => {
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
      await assertCategoriesExist(api);

      const listingRequests = await installMockSellerInBrowser(page, {
        imageUploadStatus: "needs_review",
      });

      await page.goto("/sell");

      await expect(page.getByRole("heading", { name: "İlan bilgileri" })).toBeVisible({
        timeout: 15_000,
      });

      await fillSellListingForm(page, {
        title: "Web E2E inceleme bekleyen bebek arabası",
      });

      await page.locator('input[type="file"]').setInputFiles({
        name: "babyloop-e2e-needs-review.png",
        mimeType: "image/png",
        buffer: Buffer.from(TEST_IMAGE_PNG_BASE64, "base64"),
      });

      await expect(page.getByText("babyloop-e2e-needs-review.png")).toBeVisible();

      await page.getByRole("button", { name: "İlanı oluştur" }).click();

      await expect(page).toHaveURL(/\/listings\/[a-zA-Z0-9-]+\?imageReview=needs_review$/, {
        timeout: 30_000,
      });
      await expect(page.getByRole("main")).toBeVisible();

      expect(listingRequests).toEqual([
        expect.objectContaining({
          title: "Web E2E inceleme bekleyen bebek arabası",
        }),
      ]);

      await expectNoSellUploadSensitiveLeak(page);
    } finally {
      await api.dispose();
    }
  });

  test("authenticated seller sees upload failure and stays on sell page", async ({ page }) => {
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
      await assertCategoriesExist(api);

      await installMockSellerInBrowser(page, {
        failImageUpload: true,
      });

      await page.goto("/sell");

      await expect(page.getByRole("heading", { name: "İlan bilgileri" })).toBeVisible({
        timeout: 15_000,
      });

      await fillSellListingForm(page, {
        title: "Web E2E upload failure bebek arabası",
      });

      await page.locator('input[type="file"]').setInputFiles({
        name: "babyloop-e2e-upload-failure.png",
        mimeType: "image/png",
        buffer: Buffer.from(TEST_IMAGE_PNG_BASE64, "base64"),
      });

      const uploadFailureResponsePromise = page.waitForResponse((response) => {
        return (
          isListingImageUploadResponse(response.url()) &&
          response.request().method().toUpperCase() === "POST"
        );
      });

      await page.getByRole("button", { name: "İlanı oluştur" }).click();

      const uploadFailureResponse = await uploadFailureResponsePromise;
      expect(uploadFailureResponse.ok(), await uploadFailureResponse.text()).toBe(false);

      await expect(page).toHaveURL(/\/sell$/, {
        timeout: 30_000,
      });
      await expect(page.getByRole("main")).toContainText(
        /İlan oluşturulamadı|Listing could not be created|görsel yüklenemedi|image upload failed|yüklenemedi|upload failed|başarısız|failed/i,
        {
          timeout: 15_000,
        },
      );

      await expectNoSellUploadSensitiveLeak(page);
    } finally {
      await api.dispose();
    }
  });

  test("authenticated seller cannot select more than five listing images", async ({ page }) => {
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
      await assertCategoriesExist(api);

      await installMockSellerInBrowser(page);

      await page.goto("/sell");

      await expect(page.getByRole("heading", { name: "İlan bilgileri" })).toBeVisible({
        timeout: 15_000,
      });

      const imageFiles = Array.from({ length: 6 }, (_, index) => ({
        name: `babyloop-e2e-product-${index + 1}.png`,
        mimeType: "image/png",
        buffer: Buffer.from(TEST_IMAGE_PNG_BASE64, "base64"),
      }));

      await page.locator('input[type="file"]').setInputFiles(imageFiles);

      await expect(page.getByText("En fazla 5 görsel ekleyebilirsin.", { exact: true })).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByText("babyloop-e2e-product-1.png")).toHaveCount(0);
      await expect(page.getByText("babyloop-e2e-product-5.png")).toHaveCount(0);
      await expect(page.getByText("babyloop-e2e-product-6.png")).toHaveCount(0);

      await expectNoSellUploadSensitiveLeak(page);
    } finally {
      await api.dispose();
    }
  });
});


function createMockSellerAuthPayload(): ApiResponse<AuthPayload> {
  return {
    ok: true,
    data: {
      accessToken: RAW_ACCESS_TOKEN_SENTINEL,
      profile: {
        id: "profile-sell-upload-mock-seller-e2e",
        displayName: "Web E2E Mock Seller",
        locationCity: "İstanbul",
      },
      user: {
        id: "user-sell-upload-mock-seller-e2e",
        email: RAW_EMAIL_SENTINEL,
        role: "user",
        emailVerifiedAt: "2026-01-01T00:00:00.000Z",
      },
    },
  };
}

async function installMockSellerInBrowser(
  page: Page,
  options: BrowserMockOptions = {},
): Promise<unknown[]> {
  const loginBody = createMockSellerAuthPayload();
  const listingRequests: unknown[] = [];

  await page.route("**/api/v1/auth/refresh", async (route) => {
    await fulfillAuthResponse(route, loginBody);
  });

  await page.route("**/api/v1/auth/me", async (route) => {
    await fulfillAuthResponse(route, loginBody);
  });

  await page.route("**/api/v1/listings", async (route) => {
    if (route.request().method().toUpperCase() === "POST") {
      await fulfillMockListingCreate(route, listingRequests);
      return;
    }

    await route.continue({
      url: toReachableApiUrl(route.request().url()),
    });
  });

  await page.route("**/api/v1/listings/*/images", async (route) => {
    await fulfillListingImageUpload(route, options);
  });

  await page.route("http://localhost:4000/**", async (route) => {
    const url = route.request().url();

    if (url.includes("/api/v1/auth/refresh") || url.includes("/api/v1/auth/me")) {
      await fulfillAuthResponse(route, loginBody);
      return;
    }

    if (url.endsWith("/api/v1/listings") && route.request().method().toUpperCase() === "POST") {
      await fulfillMockListingCreate(route, listingRequests);
      return;
    }

    if (isListingImageUploadRequest(route)) {
      await fulfillListingImageUpload(route, options);
      return;
    }

    await route.continue({
      url: toReachableApiUrl(url),
    });
  });

  await page.goto("/browse?sort=newest");

  return listingRequests;
}



async function fulfillMockListingCreate(
  route: Route,
  listingRequests: unknown[],
): Promise<void> {
  const requestBody = (await route.request().postDataJSON()) as {
    categoryId?: string;
    condition?: string;
    currency?: string;
    description?: string;
    listingType?: string;
    priceAmount?: string;
    title?: string;
    city?: string;
  };

  listingRequests.push(requestBody);

  const listingId = "listing-sell-upload-mock-create-e2e";
  const now = "2026-01-01T00:00:00.000Z";

  await route.fulfill({
    status: 201,
    contentType: "application/json",
    headers: getCorsHeaders(route),
    body: JSON.stringify({
      ok: true,
      data: {
        listing: {
          id: listingId,
          title: requestBody.title ?? "Web E2E mocked listing",
          description: requestBody.description ?? null,
          status: "active",
          listingType: requestBody.listingType ?? "sale",
          condition: requestBody.condition ?? "good",
          categoryId: requestBody.categoryId ?? "category-sell-upload-mock-e2e",
          city: requestBody.city ?? "İstanbul",
          price: {
            amount: requestBody.priceAmount ?? "6500",
            currency: requestBody.currency ?? "TRY",
          },
          primaryImage: null,
          images: [],
          createdAt: now,
          updatedAt: now,
        },
      },
    }),
  });
}


async function loginSellerInBrowser(
  page: Page,
  api: APIRequestContext,
  input: {
    email: string;
    password: string;
  },
  options: BrowserMockOptions = {},
): Promise<unknown[]> {
  const loginResponse = await api.post("/api/v1/auth/login", {
    data: {
      email: input.email,
      password: input.password,
    },
  });

  expect(loginResponse.ok(), await safeResponseText(loginResponse)).toBe(true);

  const loginBody = (await loginResponse.json()) as ApiResponse<AuthPayload>;
  expect(loginBody.ok).toBe(true);

  if (!loginBody.ok) {
    return [];
  }

  const listingRequests: unknown[] = [];

  await page.route("**/api/v1/auth/refresh", async (route) => {
    await fulfillAuthResponse(route, loginBody);
  });

  await page.route("**/api/v1/listings", async (route) => {
    if (route.request().method().toUpperCase() === "POST") {
      listingRequests.push(await route.request().postDataJSON());
    }

    await route.continue({
      url: toReachableApiUrl(route.request().url()),
    });
  });

  await page.route("**/api/v1/listings/*/images", async (route) => {
    await fulfillListingImageUpload(route, options);
  });

  await page.route("http://localhost:4000/**", async (route) => {
    const url = route.request().url();

    if (url.includes("/api/v1/auth/refresh")) {
      await fulfillAuthResponse(route, loginBody);
      return;
    }

    if (url.endsWith("/api/v1/listings") && route.request().method().toUpperCase() === "POST") {
      listingRequests.push(await route.request().postDataJSON());

      await route.continue({
        url: toReachableApiUrl(url),
      });
      return;
    }

    if (isListingImageUploadRequest(route)) {
      await fulfillListingImageUpload(route, options);
      return;
    }

    await route.continue({
      url: toReachableApiUrl(url),
    });
  });

  await page.goto("/browse?sort=newest");

  return listingRequests;
}

async function fulfillAuthResponse(
  route: Route,
  body: ApiResponse<AuthPayload>,
): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: getCorsHeaders(route),
    body: JSON.stringify(body),
  });
}

async function fulfillListingImageUpload(
  route: Route,
  options: BrowserMockOptions = {},
): Promise<void> {
  const method = route.request().method().toUpperCase();

  if (method === "OPTIONS") {
    await route.fulfill({
      status: 204,
      headers: getCorsHeaders(route),
    });
    return;
  }

  if (method !== "POST") {
    await route.continue({
      url: toReachableApiUrl(route.request().url()),
    });
    return;
  }

  if (options.failImageUpload) {
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      headers: getCorsHeaders(route),
      body: JSON.stringify({
        ok: false,
        error: {
          code: "IMAGE_UPLOAD_FAILED_E2E",
          message: "Görsel yüklenemedi. Lütfen farklı bir görsel dene.",
        },
      }),
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
        image: {
          id: `web-e2e-image-${Date.now()}`,
          url: "/favicon.ico",
          sortOrder: 0,
          reviewStatus: options.imageUploadStatus ?? "approved",
        },
      },
    }),
  });
}

async function fillSellListingForm(
  page: Page,
  input: {
    title: string;
  },
): Promise<void> {
  const categorySelect = page.locator('select[name="categoryId"]');
  const firstCategoryValue = await categorySelect.locator("option").first().getAttribute("value");

  test.skip(!firstCategoryValue, "The sell page has no selectable category.");

  await categorySelect.selectOption(firstCategoryValue);
  await page.locator('select[name="listingType"]').selectOption("sale");
  await page.locator('input[name="title"]').fill(input.title);
  await page
    .locator('textarea[name="description"]')
    .fill("Web E2E testi için oluşturulan temiz ve güvenli bebek arabası ilanı.");
  await page.locator('input[name="priceAmount"]').fill("6500");
  await page.locator('input[name="currency"]').fill("TRY");
  await page.locator('select[name="condition"]').selectOption("good");
  await page.locator('input[name="city"]').fill("İstanbul");
}

async function expectNoSellUploadSensitiveLeak(page: Page): Promise<void> {
  await expect(page.getByText(RAW_ACCESS_TOKEN_SENTINEL, { exact: true })).toHaveCount(0);
  await expect(page.getByText(RAW_IMAGE_BINARY_SENTINEL, { exact: true })).toHaveCount(0);
  await expect(page.getByText(RAW_EMAIL_SENTINEL, { exact: true })).toHaveCount(0);
}


function isListingImageUploadResponse(url: string): boolean {
  return /\/api\/v1\/listings\/[^/]+\/images$/.test(new URL(url).pathname);
}

function isListingImageUploadRequest(route: Route): boolean {
  return /\/api\/v1\/listings\/[^/]+\/images(?:\?|$)/.test(route.request().url());
}

function getCorsHeaders(route: Route): Record<string, string> {
  const origin = route.request().headers()["origin"] ?? "http://localhost:3000";

  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "authorization,content-type,x-babyloop-csrf-token",
    "vary": "Origin",
  };
}

function toReachableApiUrl(url: string): string {
  return url.replace("http://localhost:4000", API_BASE_URL);
}

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

async function assertCategoriesExist(api: APIRequestContext): Promise<void> {
  const response = await api.get("/api/v1/categories");
  expect(response.ok(), await safeResponseText(response)).toBe(true);

  const body = (await response.json()) as ApiResponse<CategoriesPayload>;
  expect(body.ok).toBe(true);

  if (body.ok) {
    expect(body.data.categories.length).toBeGreaterThan(0);
  }
}

async function createVerifiedSeller(
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
    .slice(0, 500);
}
