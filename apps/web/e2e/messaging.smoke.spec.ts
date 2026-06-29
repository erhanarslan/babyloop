import { expect, test, type Page, type Route } from "@playwright/test";
import {
  FULL_FLOW_ENABLED,
  installAuthRefreshRoute,
  type AuthPayload,
} from "./helpers/web-e2e-api";

const MOCK_ACCESS_TOKEN = "mock-messaging-access-token";
const MOCK_BUYER_EMAIL = "web-e2e-message-buyer@babyloop.test";
const BUYER_PROFILE_ID = "web-e2e-message-buyer-profile";
const SELLER_PROFILE_ID = "web-e2e-message-seller-profile";
const CONVERSATION_ID = "web-e2e-conversation-1";
const LISTING_ID = "web-e2e-message-listing-1";
const LISTING_TITLE = "Web E2E mesajlaşma bebek arabası";
const SELLER_DISPLAY_NAME = "Web E2E Message Seller";

test.describe("messaging flow", () => {
  test("buyer can open a conversation detail and send a message", async ({ page }) => {
    test.skip(
      !FULL_FLOW_ENABLED,
      "Set WEB_E2E_FULL_FLOW=1 and run the API + web app before this full-flow E2E.",
    );
    test.setTimeout(60_000);

    const auth = buildMockAuth();
    const messageText = `Merhaba, bu ürün hâlâ uygun mu? ${Date.now()}`;

    await installAuthRefreshRoute(page, auth);
    await installAuthMeRoute(page, auth);
    await installMessagingRoutes(page, {
      messageText,
    });

    await page.goto(`/conversations?conversationId=${CONVERSATION_ID}`, { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(new RegExp(`/conversations\\?conversationId=${CONVERSATION_ID}$`), {
      timeout: 15_000,
    });
    await expect(page.getByRole("heading", { name: SELLER_DISPLAY_NAME })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("link", { name: LISTING_TITLE, exact: true })).toBeVisible();

    const messageBox = page.getByRole("textbox", { name: "Mesaj" });
    await expect(messageBox).toBeVisible();

    await messageBox.fill(messageText);

    const sendMessageResponsePromise = page.waitForResponse((response) => {
      return response.url().includes(`/api/v1/conversations/${CONVERSATION_ID}/messages`) &&
        response.request().method() === "POST";
    });

    await page.getByRole("button", { name: "Gönder" }).click();

    const sendMessageResponse = await sendMessageResponsePromise;
    expect(sendMessageResponse.ok(), await sendMessageResponse.text()).toBe(true);

    await expect(page.getByText(messageText, { exact: true })).toBeVisible({
      timeout: 15_000,
    });

    await expectNoMessagingSensitiveLeak(page);
  });
});

function buildMockAuth(): AuthPayload {
  return {
    accessToken: MOCK_ACCESS_TOKEN,
    user: {
      id: "web-e2e-message-buyer-user",
      email: MOCK_BUYER_EMAIL,
      role: "user",
      emailVerifiedAt: new Date().toISOString(),
    },
    profile: {
      id: BUYER_PROFILE_ID,
      displayName: "Web E2E Message Buyer",
      locationCity: "İstanbul",
    },
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

async function installMessagingRoutes(
  page: Page,
  input: {
    messageText: string;
  },
): Promise<void> {
  let messages = [buildSellerMessage()];

  await page.route("**/api/v1/conversations", async (route) => {
    const method = route.request().method().toUpperCase();

    if (method === "OPTIONS") {
      await route.fulfill({
        status: 204,
        headers: getCorsHeaders(route),
      });
      return;
    }

    expect(method).toBe("GET");

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: getCorsHeaders(route),
      body: JSON.stringify({
        ok: true,
        data: {
          conversations: [buildConversation()],
        },
      }),
    });
  });

  await page.route(`**/api/v1/conversations/${CONVERSATION_ID}`, async (route) => {
    const method = route.request().method().toUpperCase();

    if (method === "OPTIONS") {
      await route.fulfill({
        status: 204,
        headers: getCorsHeaders(route),
      });
      return;
    }

    expect(method).toBe("GET");

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: getCorsHeaders(route),
      body: JSON.stringify({
        ok: true,
        data: {
          conversation: buildConversation(),
        },
      }),
    });
  });

  await page.route(`**/api/v1/conversations/${CONVERSATION_ID}/messages`, async (route) => {
    const method = route.request().method().toUpperCase();

    if (method === "OPTIONS") {
      await route.fulfill({
        status: 204,
        headers: getCorsHeaders(route),
      });
      return;
    }

    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: getCorsHeaders(route),
        body: JSON.stringify({
          ok: true,
          data: {
            messages,
          },
        }),
      });
      return;
    }

    expect(method).toBe("POST");

    const buyerMessage = buildBuyerMessage(input.messageText);
    messages = [...messages, buyerMessage];

    await route.fulfill({
      status: 201,
      contentType: "application/json",
      headers: getCorsHeaders(route),
      body: JSON.stringify({
        ok: true,
        data: {
          message: buyerMessage,
        },
      }),
    });
  });

  await page.route(`**/api/v1/conversations/${CONVERSATION_ID}/read`, async (route) => {
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
          conversation: {
            ...buildConversation(),
            unreadCount: 0,
          },
          unreadConversationCount: 0,
          unreadNotificationCount: 0,
        },
      }),
    });
  });

  await page.route("**/api/v1/me/blocked-profiles", fulfillEmptyBlockedProfiles);
  await page.route("**/api/v1/profiles/blocked", fulfillEmptyBlockedProfiles);
  await page.route("**/api/v1/blocked-profiles", fulfillEmptyBlockedProfiles);
}

function buildConversation() {
  const now = new Date().toISOString();
  const sellerMessage = buildSellerMessage();

  return {
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
      body: sellerMessage.body,
      senderProfileId: sellerMessage.sender.id,
      createdAt: sellerMessage.createdAt,
    },
    unreadCount: 0,
    status: "active",
    lastMessageAt: sellerMessage.createdAt,
    createdAt: now,
    updatedAt: sellerMessage.createdAt,
  };
}

function buildSellerMessage() {
  return {
    id: "web-e2e-message-initial",
    conversationId: CONVERSATION_ID,
    body: "Merhaba, ürün hakkında sorularını yanıtlayabilirim.",
    sender: {
      id: SELLER_PROFILE_ID,
      displayName: SELLER_DISPLAY_NAME,
    },
    createdAt: new Date().toISOString(),
    deletedAt: null,
  };
}

function buildBuyerMessage(body: string) {
  return {
    id: "web-e2e-message-buyer-reply",
    conversationId: CONVERSATION_ID,
    body,
    sender: {
      id: BUYER_PROFILE_ID,
      displayName: "Web E2E Message Buyer",
    },
    createdAt: new Date().toISOString(),
    deletedAt: null,
  };
}

async function fulfillEmptyBlockedProfiles(route: Route): Promise<void> {
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
        blockedProfiles: [],
        profiles: [],
      },
    }),
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

async function expectNoMessagingSensitiveLeak(page: Page): Promise<void> {
  const body = page.locator("body");

  await expect(body).not.toContainText(MOCK_BUYER_EMAIL);
  await expect(body).not.toContainText(MOCK_ACCESS_TOKEN);
  await expect(body).not.toContainText("accessToken");
  await expect(body).not.toContainText("refreshToken");
}
