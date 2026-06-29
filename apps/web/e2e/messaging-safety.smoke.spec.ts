import { expect, test, type Page, type Route } from "@playwright/test";
import {
  FULL_FLOW_ENABLED,
  installAuthRefreshRoute,
  type AuthPayload,
} from "./helpers/web-e2e-api";

type ConversationSummary = {
  id: string;
  otherProfile: {
    id: string;
    displayName: string;
  };
  contextListing: {
    id: string;
    title: string;
  } | null;
  latestMessage: {
    body: string;
    senderProfileId: string;
    createdAt: string;
  } | null;
  unreadCount: number;
  status: string;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type Message = {
  id: string;
  conversationId: string;
  sender: {
    id: string;
    displayName: string;
  };
  body: string;
  createdAt: string;
  deletedAt: string | null;
};

type MessagingSafetyState = {
  conversation: ConversationSummary;
  messages: Message[];
  unsafeSendRequests: string[];
};

const MOCK_ACCESS_TOKEN = "mock-messaging-safety-access-token";
const MOCK_BUYER_EMAIL = "web-e2e-messaging-safety-buyer@babyloop.test";
const BUYER_PROFILE_ID = "web-e2e-messaging-safety-buyer-profile";
const SELLER_PROFILE_ID = "web-e2e-messaging-safety-seller-profile";
const CONVERSATION_ID = "web-e2e-messaging-safety-conversation";
const LISTING_ID = "web-e2e-messaging-safety-listing";
const LISTING_TITLE = "Web E2E güvenli mesaj ürünü";
const SELLER_DISPLAY_NAME = "Web E2E Safe Msg Seller";
const UNSAFE_MESSAGE = "<script>alert('xss')</script>";

test.describe("messaging safety flow", () => {
  test("unsafe script-like message is blocked before sending", async ({ page }) => {
    test.skip(
      !FULL_FLOW_ENABLED,
      "Set WEB_E2E_FULL_FLOW=1 and run the API + web app before this full-flow E2E.",
    );
    test.setTimeout(60_000);

    const auth = buildMockAuth();
    const state = buildMessagingSafetyState();

    await installAuthRefreshRoute(page, auth);
    await installMessagingSafetyRoutes(page, state);

    await page.goto(`/conversations?conversationId=${CONVERSATION_ID}`, {
      waitUntil: "domcontentloaded",
    });

    await expect(page).toHaveURL(new RegExp(`/conversations\\?conversationId=${CONVERSATION_ID}$`), {
      timeout: 15_000,
    });
    await expect(page.getByRole("heading", { name: SELLER_DISPLAY_NAME, exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("link", { name: LISTING_TITLE, exact: true })).toBeVisible();

    const messageBox = page.getByRole("textbox", { name: "Mesaj" });
    await expect(messageBox).toBeVisible();

    await messageBox.fill(UNSAFE_MESSAGE);

    await expect(
      page.getByText("Kod benzeri metni çıkarıp ürüne odaklı kısa bir mesaj yaz.", { exact: true }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Gönder", exact: true }).click();

    await expect(
      page.getByText("Bu mesaj güvenli görünmüyor. Lütfen özel bilgi veya kod benzeri içerik olmadan tekrar yaz.", {
        exact: true,
      }),
    ).toBeVisible();

    await expect
      .poll(() => state.unsafeSendRequests, {
        intervals: [250, 500],
        timeout: 1_500,
      })
      .toEqual([]);

    await expectNoMessagingSafetyLeak(page);
  });
});

function buildMockAuth(): AuthPayload {
  return {
    accessToken: MOCK_ACCESS_TOKEN,
    user: {
      id: "web-e2e-messaging-safety-buyer-user",
      email: MOCK_BUYER_EMAIL,
      role: "user",
      emailVerifiedAt: new Date().toISOString(),
    },
    profile: {
      id: BUYER_PROFILE_ID,
      displayName: "Web E2E Safe Msg Buyer",
      locationCity: "İstanbul",
    },
  };
}

async function installMessagingSafetyRoutes(page: Page, state: MessagingSafetyState): Promise<void> {
  await page.route("**/api/v1/**", async (route) => {
    if (await fulfillOptions(route)) {
      return;
    }

    const request = route.request();
    const url = new URL(request.url());
    const method = request.method().toUpperCase();

    if (method === "GET" && pathEndsWith(url, "/api/v1/auth/me")) {
      await fulfillJson(route, {
        ok: true,
        data: createCurrentUserPayload(),
      });
      return;
    }

    if (method === "POST" && pathEndsWith(url, "/api/v1/auth/refresh")) {
      await fulfillJson(route, {
        ok: true,
        data: {
          ...createCurrentUserPayload(),
          accessToken: MOCK_ACCESS_TOKEN,
        },
      });
      return;
    }

    if (method === "GET" && pathEndsWith(url, "/api/v1/auth/csrf")) {
      await fulfillJson(route, {
        ok: true,
        data: {
          csrfToken: "messaging-safety-e2e-csrf",
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

    if (method === "GET" && pathEndsWith(url, "/api/v1/notifications")) {
      await fulfillJson(route, {
        ok: true,
        data: {
          notifications: [],
        },
      });
      return;
    }

    if (method === "GET" && pathEndsWith(url, "/api/v1/conversations")) {
      await fulfillJson(route, {
        ok: true,
        data: {
          conversations: [state.conversation],
        },
      });
      return;
    }

    if (method === "GET" && pathEndsWith(url, `/api/v1/conversations/${CONVERSATION_ID}`)) {
      await fulfillJson(route, {
        ok: true,
        data: {
          conversation: state.conversation,
        },
      });
      return;
    }

    if (method === "GET" && pathEndsWith(url, `/api/v1/conversations/${CONVERSATION_ID}/messages`)) {
      await fulfillJson(route, {
        ok: true,
        data: {
          messages: state.messages,
        },
      });
      return;
    }

    if (method === "PATCH" && pathEndsWith(url, `/api/v1/conversations/${CONVERSATION_ID}/read`)) {
      await fulfillJson(route, {
        ok: true,
        data: {
          conversation: {
            ...state.conversation,
            unreadCount: 0,
          },
          unreadConversationCount: 0,
          unreadNotificationCount: 0,
        },
      });
      return;
    }

    if (method === "POST" && pathEndsWith(url, `/api/v1/conversations/${CONVERSATION_ID}/messages`)) {
      const body = (await request.postDataJSON()) as { body?: string };

      state.unsafeSendRequests.push(body.body ?? "");

      await fulfillJson(
        route,
        {
          ok: false,
          error: {
            code: "WEB_E2E_UNSAFE_MESSAGE_SHOULD_NOT_BE_SENT",
            message: "Unsafe message should be blocked before network send.",
          },
        },
        500,
      );
      return;
    }

    if (method === "GET" && pathEndsWith(url, "/api/v1/profiles/blocked")) {
      await fulfillJson(route, {
        ok: true,
        data: {
          blockedProfiles: [],
        },
      });
      return;
    }

    await fulfillJson(
      route,
      {
        ok: false,
        error: {
          code: "WEB_E2E_UNHANDLED_ROUTE",
          message: `Unhandled messaging safety E2E route: ${method} ${url.pathname}`,
        },
      },
      500,
    );
  });
}

function buildMessagingSafetyState(): MessagingSafetyState {
  const now = new Date().toISOString();

  return {
    conversation: {
      id: CONVERSATION_ID,
      otherProfile: {
        id: SELLER_PROFILE_ID,
        displayName: SELLER_DISPLAY_NAME,
      },
      contextListing: {
        id: LISTING_ID,
        title: LISTING_TITLE,
      },
      latestMessage: {
        body: "Merhaba, ürün hakkında sorularını yanıtlayabilirim.",
        senderProfileId: SELLER_PROFILE_ID,
        createdAt: now,
      },
      unreadCount: 0,
      status: "active",
      lastMessageAt: now,
      createdAt: now,
      updatedAt: now,
    },
    messages: [
      {
        id: "web-e2e-messaging-safety-initial-message",
        conversationId: CONVERSATION_ID,
        sender: {
          id: SELLER_PROFILE_ID,
          displayName: SELLER_DISPLAY_NAME,
        },
        body: "Merhaba, ürün hakkında sorularını yanıtlayabilirim.",
        createdAt: now,
        deletedAt: null,
      },
    ],
    unsafeSendRequests: [],
  };
}

function createCurrentUserPayload() {
  return {
    user: {
      id: "web-e2e-messaging-safety-buyer-user",
      email: MOCK_BUYER_EMAIL,
      emailVerifiedAt: new Date().toISOString(),
    },
    profile: {
      id: BUYER_PROFILE_ID,
      displayName: "Web E2E Safe Msg Buyer",
      locationCity: "İstanbul",
      avatarUrl: null,
    },
  };
}

async function expectNoMessagingSafetyLeak(page: Page): Promise<void> {
  const body = page.locator("body");

  await expect(body).not.toContainText(MOCK_BUYER_EMAIL);
  await expect(body).not.toContainText(MOCK_ACCESS_TOKEN);
  await expect(body).not.toContainText("accessToken");
  await expect(body).not.toContainText("refreshToken");
  await expect(body).not.toContainText("password");
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
