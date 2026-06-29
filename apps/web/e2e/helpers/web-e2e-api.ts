import { expect, type APIRequestContext, type Page, type Route } from "@playwright/test";

export type ApiResponse<TData> =
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

export type AuthPayload = {
  accessToken: string;
  devEmailVerificationToken?: string;
  user: {
    id: string;
    email: string;
    role: string;
    emailVerifiedAt?: string | null;
  };
  profile: {
    id: string;
    displayName: string;
    locationCity: string | null;
  };
};

export type CategoryPayload = {
  categories: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
};

export type ListingLifecycleStatus = "active" | "reserved" | "sold" | "archived";

export type ListingPayload = {
  listing: {
    id: string;
    title: string;
    status?: ListingLifecycleStatus | string;
  };
};

export type MyListingsPayload = {
  listings: Array<{
    id: string;
    title: string;
    status: ListingLifecycleStatus | string;
  }>;
};

export type ConversationPayload = {
  conversation: {
    id: string;
  };
};

export type PublicCsrfPayload = {
  csrfToken: string;
};

export type FavoritesPayload = {
  favorites: Array<{
    id: string;
    title: string;
  }>;
};

export const API_BASE_URL =
  process.env.WEB_E2E_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:4000";

export const FULL_FLOW_ENABLED = process.env.WEB_E2E_FULL_FLOW === "1";

export const E2E_PASSWORD = "Password12345!";

export async function assertApiIsAvailable(api: APIRequestContext): Promise<void> {
  try {
    const response = await api.get("/health");
    expect(response.ok(), await safeResponseText(response)).toBe(true);
  } catch (error) {
    throw new Error(
      `BabyLoop API is not reachable at ${API_BASE_URL}. Start the API/web dev stack first or set WEB_E2E_API_BASE_URL=http://127.0.0.1:4000. ${String(error)}`,
    );
  }
}

export async function fetchFirstCategoryId(api: APIRequestContext): Promise<string> {
  const response = await api.get("/api/v1/categories");
  expect(response.ok(), await safeResponseText(response)).toBe(true);

  const body = (await response.json()) as ApiResponse<CategoryPayload>;
  expect(body.ok).toBe(true);

  if (!body.ok || body.data.categories.length === 0) {
    throw new Error("No category exists for web E2E listing setup.");
  }

  return body.data.categories[0]!.id;
}

export async function createVerifiedUser(
  api: APIRequestContext,
  input: {
    displayName: string;
    email: string;
    locationCity: string;
    password: string;
  },
): Promise<AuthPayload> {
  const registerResponse = await api.post("/api/v1/auth/register", {
    data: input,
  });

  expect(registerResponse.ok(), await safeResponseText(registerResponse)).toBe(true);

  const registerBody = (await registerResponse.json()) as ApiResponse<AuthPayload>;
  expect(registerBody.ok).toBe(true);

  if (!registerBody.ok) {
    throw new Error("Registration failed.");
  }

  if (registerBody.data.devEmailVerificationToken) {
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

  return registerBody.data;
}

export async function createListing(
  api: APIRequestContext,
  input: {
    accessToken: string;
    categoryId: string;
    condition?: "new" | "like_new" | "good" | "fair" | "needs_repair";
    currency?: string;
    description?: string;
    listingType?: "sale" | "swap" | "donation";
    priceAmount?: string;
    title: string;
  },
): Promise<ListingPayload["listing"]> {
  const csrfToken = await fetchPublicCsrfToken(api);

  const response = await api.post("/api/v1/listings", {
    headers: {
      ...authHeader(input.accessToken),
      "x-babyloop-csrf-token": csrfToken,
    },
    data: {
      categoryId: input.categoryId,
      listingType: input.listingType ?? "sale",
      title: input.title,
      description: input.description ?? "Web E2E testi için oluşturulan güvenli marketplace ilanı.",
      priceAmount: input.priceAmount ?? "6500",
      currency: input.currency ?? "TRY",
      condition: input.condition ?? "good",
    },
  });

  expect(response.ok(), await safeResponseText(response)).toBe(true);

  const body = (await response.json()) as ApiResponse<ListingPayload>;
  expect(body.ok).toBe(true);

  if (!body.ok) {
    throw new Error("Listing setup failed.");
  }

  return body.data.listing;
}

export async function updateListingStatus(
  api: APIRequestContext,
  input: {
    accessToken: string;
    listingId: string;
    status: ListingLifecycleStatus;
  },
): Promise<ListingPayload["listing"]> {
  const csrfToken = await fetchPublicCsrfToken(api);

  const response = await api.patch(`/api/v1/listings/${input.listingId}/status`, {
    headers: {
      ...authHeader(input.accessToken),
      "x-babyloop-csrf-token": csrfToken,
    },
    data: {
      status: input.status,
    },
  });

  expect(response.ok(), await safeResponseText(response)).toBe(true);

  const body = (await response.json()) as ApiResponse<ListingPayload>;
  expect(body.ok).toBe(true);

  if (!body.ok) {
    throw new Error("Listing status update failed.");
  }

  expect(body.data.listing.status).toBe(input.status);

  return body.data.listing;
}

export async function expectMyListingStatus(
  api: APIRequestContext,
  input: {
    accessToken: string;
    listingId: string;
    status: ListingLifecycleStatus;
  },
): Promise<void> {
  await expect
    .poll(
      async () => {
        const response = await api.get("/api/v1/me/listings", {
          headers: authHeader(input.accessToken),
        });

        if (!response.ok()) {
          throw new Error(await safeResponseText(response));
        }

        const body = (await response.json()) as ApiResponse<MyListingsPayload>;

        if (!body.ok) {
          throw new Error(JSON.stringify(body));
        }

        return body.data.listings.find((listing) => listing.id === input.listingId)?.status ?? null;
      },
      {
        intervals: [250, 500, 1000],
        timeout: 10_000,
      },
    )
    .toBe(input.status);
}

export async function createConversation(
  api: APIRequestContext,
  input: {
    accessToken: string;
    listingId: string;
  },
): Promise<ConversationPayload["conversation"]> {
  const csrfToken = await fetchPublicCsrfToken(api);

  const response = await api.post("/api/v1/conversations", {
    headers: {
      ...authHeader(input.accessToken),
      "x-babyloop-csrf-token": csrfToken,
    },
    data: {
      listingId: input.listingId,
    },
  });

  expect(response.ok(), await safeResponseText(response)).toBe(true);

  const body = (await response.json()) as ApiResponse<ConversationPayload>;
  expect(body.ok).toBe(true);

  if (!body.ok) {
    throw new Error("Conversation setup failed.");
  }

  return body.data.conversation;
}

export async function installAuthRefreshRoute(page: Page, auth: AuthPayload): Promise<void> {
  await page.route("**/api/v1/auth/refresh", async (route) => {
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
        data: auth,
      } satisfies ApiResponse<AuthPayload>),
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

export async function loginWithUi(
  page: Page,
  input: {
    email: string;
    password: string;
  },
): Promise<void> {
  await page.goto("/login", { waitUntil: "domcontentloaded" });

  const loginForm = page.locator("form.auth-form-polished");
  await expect(loginForm).toBeVisible();

  await loginForm.locator('input[name="email"]').fill(input.email);
  await loginForm.locator('input[name="password"]').fill(input.password);

  const loginResponsePromise = page.waitForResponse((response) => {
    return response.url().includes("/api/v1/auth/login") && response.request().method() === "POST";
  });

  await loginForm.getByRole("button", { name: "Giriş yap" }).click();

  const loginResponse = await loginResponsePromise;
  expect(loginResponse.ok(), await safeResponseText(loginResponse)).toBe(true);

  await expect(page).toHaveURL(/\/browse/, { timeout: 15_000 });
}

export async function expectFavoriteState(
  api: APIRequestContext,
  input: {
    accessToken: string;
    listingId: string;
    favorited: boolean;
  },
): Promise<void> {
  await expect
    .poll(
      async () => {
        const response = await api.get("/api/v1/favorites", {
          headers: authHeader(input.accessToken),
        });

        if (!response.ok()) {
          throw new Error(await safeResponseText(response));
        }

        const body = (await response.json()) as ApiResponse<FavoritesPayload>;

        if (!body.ok) {
          throw new Error(JSON.stringify(body));
        }

        return body.data.favorites.some((favorite) => favorite.id === input.listingId);
      },
      {
        intervals: [250, 500, 1000],
        timeout: 10_000,
      },
    )
    .toBe(input.favorited);
}

export async function fetchPublicCsrfToken(api: APIRequestContext): Promise<string> {
  const response = await api.get("/api/v1/auth/csrf");
  expect(response.ok(), await safeResponseText(response)).toBe(true);

  const body = (await response.json()) as ApiResponse<PublicCsrfPayload>;
  expect(body.ok).toBe(true);

  if (!body.ok) {
    throw new Error("Public CSRF token setup failed.");
  }

  return body.data.csrfToken;
}

export function authHeader(accessToken: string): Record<string, string> {
  return {
    authorization: `Bearer ${accessToken}`,
  };
}

export async function safeResponseText(response: { text: () => Promise<string> }): Promise<string> {
  const text = await response.text();

  return text
    .replace(/accessToken":"[^"]+"/g, 'accessToken":"[redacted]"')
    .replace(/refreshToken":"[^"]+"/g, 'refreshToken":"[redacted]"')
    .replace(/password":"[^"]+"/g, 'password":"[redacted]"')
    .slice(0, 500);
}
