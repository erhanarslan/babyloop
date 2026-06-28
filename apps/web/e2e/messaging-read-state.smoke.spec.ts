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

type MockState = {
  conversation: ConversationSummary;
  messages: Message[];
  unreadNotificationCount: number;
  readRequests: string[];
  sendRequests: string[];
};

const CURRENT_PROFILE_ID = "profile-current-web-read-e2e";
const OTHER_PROFILE_ID = "profile-other-web-read-e2e";
const CONVERSATION_ID = "conversation-web-read-e2e-1";
const LISTING_ID = "listing-web-read-e2e-1";
const INCOMING_MESSAGE_ID = "message-incoming-web-read-e2e-1";
const SENT_MESSAGE_ID = "message-sent-web-read-e2e-1";

const RAW_PROFILE_ID = "raw-profile-id-should-not-render";
const RAW_EMAIL = "raw-public-message-e2e@babyloop.test";
const RAW_PHONE = "+90 555 987 65 43";
const RAW_TOKEN = "RAW_PUBLIC_ACCESS_TOKEN_SHOULD_NOT_RENDER";
const RAW_PRIVATE_NOTE = "RAW_PRIVATE_MESSAGE_NOTE_SHOULD_NOT_RENDER";

test.describe("public messaging read state", () => {
  test("opening unread thread marks conversation and notification count read while preserving message safety", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    const state = createMessagingState();

    await installMessagingMocks(page, state);

    const readResponsePromise = page.waitForResponse((response) => {
      return (
        response.url().includes(`/api/v1/conversations/${CONVERSATION_ID}/read`) &&
        response.request().method() === "PATCH"
      );
    });

    await page.goto(`/conversations?conversationId=${CONVERSATION_ID}`, {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByRole("heading", { name: "Web Read Seller", exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("link", { name: "Web read-state stroller", exact: true })).toHaveAttribute(
      "href",
      `/listings/${LISTING_ID}`,
    );
    const messageList = page.getByRole("list").filter({
      has: page.getByText("Merhaba, ürünü görmek istiyorum.", { exact: true }),
    });

    await expect(
      messageList.getByText("Merhaba, ürün hâlâ uygun mu? [redacted-contact]", { exact: true }),
    ).toBeVisible();

    const readResponse = await readResponsePromise;
    expect(readResponse.ok(), await readResponse.text()).toBe(true);
    expect(state.readRequests).toEqual([CONVERSATION_ID]);

    const conversationCard = page.locator(`a[href="/conversations?conversationId=${CONVERSATION_ID}"]`);

    await expect(conversationCard.getByText("Okundu", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(conversationCard.getByText("Okunmadı", { exact: true })).toHaveCount(0);
    await expect(conversationCard.getByText("2", { exact: true })).toHaveCount(0);

    await expect(page.locator(".market-notifications-trigger")).toContainText("4", {
      timeout: 15_000,
    });

    await page.getByRole("button", { name: "Okunmamış", exact: true }).click();
    await expect(page.getByText("Bu filtreyle eşleşen konuşma yok.", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Tümü", exact: true }).click();
    await expect(conversationCard).toBeVisible();

    await expectNoSensitiveMessagingLeak(page);

    const messageBox = page.getByRole("textbox", { name: "Mesaj" });

    await messageBox.fill("<script>alert('xss')</script>");
    await expect(
      page.getByText("Kod benzeri metni çıkarıp ürüne odaklı kısa bir mesaj yaz.", { exact: true }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Gönder", exact: true }).click();

    await expect(
      page.getByText("Bu mesaj güvenli görünmüyor. Lütfen özel bilgi veya kod benzeri içerik olmadan tekrar yaz.", {
        exact: true,
      }),
    ).toBeVisible();

    expect(state.sendRequests).toEqual([]);

    const safeMessage = "Teslim için hafta sonu uygun musunuz?";
    await messageBox.fill(safeMessage);

    const sendResponsePromise = page.waitForResponse((response) => {
      return (
        response.url().includes(`/api/v1/conversations/${CONVERSATION_ID}/messages`) &&
        response.request().method() === "POST"
      );
    });

    await page.getByRole("button", { name: "Gönder", exact: true }).click();

    const sendResponse = await sendResponsePromise;
    expect(sendResponse.ok(), await sendResponse.text()).toBe(true);
    expect(state.sendRequests).toEqual([safeMessage]);

    await expect(messageList.getByText(safeMessage, { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(messageList.getByText("Sen", { exact: true }).last()).toBeVisible();

    await expectNoSensitiveMessagingLeak(page);
  });
});

async function installMessagingMocks(page: Page, state: MockState): Promise<void> {
  await page.route("**/api/v1/**", async (route) => {
    if (await fulfillOptions(route)) {
      return;
    }

    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

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
          accessToken: "mock-public-access-token",
        },
      });
      return;
    }

    if (method === "GET" && pathEndsWith(url, "/api/v1/auth/csrf")) {
      await fulfillJson(route, {
        ok: true,
        data: {
          csrfToken: "public-messaging-read-state-e2e-csrf",
        },
      });
      return;
    }

    if (method === "GET" && pathEndsWith(url, "/api/v1/notifications/unread-count")) {
      await fulfillJson(route, {
        ok: true,
        data: {
          count: state.unreadNotificationCount,
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
      state.readRequests.push(CONVERSATION_ID);
      state.conversation = {
        ...state.conversation,
        unreadCount: 0,
        updatedAt: "2026-06-28T09:10:00.000Z",
      };
      state.unreadNotificationCount = 4;

      await fulfillJson(route, {
        ok: true,
        data: {
          conversation: state.conversation,
          unreadConversationCount: 0,
          unreadNotificationCount: state.unreadNotificationCount,
        },
      });
      return;
    }

    if (method === "POST" && pathEndsWith(url, `/api/v1/conversations/${CONVERSATION_ID}/messages`)) {
      const body = (await request.postDataJSON()) as { body?: string };
      const messageBody = body.body?.trim() ?? "";

      state.sendRequests.push(messageBody);

      const sentMessage: Message = {
        id: SENT_MESSAGE_ID,
        conversationId: CONVERSATION_ID,
        sender: {
          id: CURRENT_PROFILE_ID,
          displayName: "Web Read Buyer",
        },
        body: messageBody,
        createdAt: "2026-06-28T09:20:00.000Z",
        deletedAt: null,
      };

      state.messages = [...state.messages, sentMessage];
      state.conversation = {
        ...state.conversation,
        latestMessage: {
          body: messageBody,
          senderProfileId: CURRENT_PROFILE_ID,
          createdAt: sentMessage.createdAt,
        },
        lastMessageAt: sentMessage.createdAt,
        updatedAt: sentMessage.createdAt,
      };

      await fulfillJson(route, {
        ok: true,
        data: {
          message: sentMessage,
        },
      });
      return;
    }

    if (
      method === "GET" &&
      (url.pathname.includes("/blocked") || url.pathname.includes("/blocks") || url.pathname.includes("/block"))
    ) {
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
          message: `Unhandled messaging read-state E2E route: ${method} ${url.pathname}`,
        },
      },
      500,
    );
  });
}

function createMessagingState(): MockState {
  return {
    conversation: {
      id: CONVERSATION_ID,
      otherProfile: {
        id: OTHER_PROFILE_ID,
        displayName: "Web Read Seller",
      },
      contextListing: {
        id: LISTING_ID,
        title: "Web read-state stroller",
      },
      latestMessage: {
        body: "Merhaba, ürün hâlâ uygun mu? [redacted-contact]",
        senderProfileId: OTHER_PROFILE_ID,
        createdAt: "2026-06-28T09:00:00.000Z",
      },
      unreadCount: 2,
      status: "active",
      lastMessageAt: "2026-06-28T09:00:00.000Z",
      createdAt: "2026-06-28T08:00:00.000Z",
      updatedAt: "2026-06-28T09:00:00.000Z",
    },
    messages: [
      {
        id: "message-current-web-read-e2e-1",
        conversationId: CONVERSATION_ID,
        sender: {
          id: CURRENT_PROFILE_ID,
          displayName: "Web Read Buyer",
        },
        body: "Merhaba, ürünü görmek istiyorum.",
        createdAt: "2026-06-28T08:55:00.000Z",
        deletedAt: null,
      },
      {
        id: INCOMING_MESSAGE_ID,
        conversationId: CONVERSATION_ID,
        sender: {
          id: OTHER_PROFILE_ID,
          displayName: "Web Read Seller",
        },
        body: "Merhaba, ürün hâlâ uygun mu? [redacted-contact]",
        createdAt: "2026-06-28T09:00:00.000Z",
        deletedAt: null,
      },
    ],
    unreadNotificationCount: 7,
    readRequests: [],
    sendRequests: [],
  };
}

function createCurrentUserPayload() {
  return {
    user: {
      id: "user-current-web-read-e2e",
      email: "web-read-current@babyloop.test",
      emailVerifiedAt: "2026-06-28T08:00:00.000Z",
    },
    profile: {
      id: CURRENT_PROFILE_ID,
      displayName: "Web Read Buyer",
      locationCity: "İstanbul",
      avatarUrl: null,
    },
  };
}

async function expectNoSensitiveMessagingLeak(page: Page): Promise<void> {
  await expect(page.getByText(RAW_PROFILE_ID, { exact: true })).toHaveCount(0);
  await expect(page.getByText(RAW_EMAIL, { exact: true })).toHaveCount(0);
  await expect(page.getByText(RAW_PHONE, { exact: true })).toHaveCount(0);
  await expect(page.getByText(RAW_TOKEN, { exact: true })).toHaveCount(0);
  await expect(page.getByText(RAW_PRIVATE_NOTE, { exact: true })).toHaveCount(0);
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

function getCorsHeaders(route: Route): Record<string, string> {
  const origin = route.request().headers().origin ?? "http://localhost:3000";

  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "authorization,content-type,x-babyloop-csrf-token",
  };
}

function pathEndsWith(url: URL, suffix: string): boolean {
  return url.pathname === suffix || url.pathname.endsWith(suffix);
}
