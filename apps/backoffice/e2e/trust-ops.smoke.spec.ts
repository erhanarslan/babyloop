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

type BackofficeAuth = {
  user: {
    id: string;
    email: string;
    role: "admin";
    emailVerifiedAt: string;
    profileId: string;
    displayName: string;
    locationCity: string | null;
  };
};

const ADMIN_AUTH: BackofficeAuth = {
  user: {
    id: "admin-trust-ops-e2e",
    email: "admin-trust-ops-e2e@babyloop.test",
    role: "admin",
    emailVerifiedAt: "2026-01-01T00:00:00.000Z",
    profileId: "admin-profile-trust-ops-e2e",
    displayName: "Backoffice Trust Ops Admin",
    locationCity: "İstanbul",
  },
};

const PROFILE_ID = "profile-trust-ops-e2e-1";
const LISTING_ID = "listing-trust-ops-e2e-1";
const CASE_ID = "case-trust-ops-e2e-1";
const CONVERSATION_ID = "conversation-trust-ops-e2e-1";
const MESSAGE_ID = "message-trust-ops-e2e-1";

const RAW_EMAIL_SENTINEL = "raw-parent-private@example.test";
const RAW_PHONE_SENTINEL = "+905551112233";
const RAW_TOKEN_SENTINEL = "sk-trust-ops-secret-token";
const RAW_MESSAGE_SENTINEL = "raw private message body should never render";
const RAW_REPORT_SENTINEL = "raw report reason should never render";

test.describe("backoffice trust operations", () => {
  test("admin can review profile trust data and apply audited profile enforcement", async ({ page }) => {
    const state = createTrustOpsState();

    await installTrustOpsMocks(page, state);

    await page.goto("/profiles", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Profiles", exact: true })).toBeVisible({
      timeout: 15_000,
    });
    const profileCard = page.locator("article").filter({ hasText: "Trust Ops Parent" });
    await expect(profileCard).toBeVisible();
    await expect(profileCard.getByText("Critical", { exact: true })).toBeVisible();
    await expect(profileCard.locator(`a[href="/profiles/${PROFILE_ID}"]`)).toBeVisible();

    await expectNoTrustOpsSensitiveLeak(page);

    await page.locator(`a[href="/profiles/${PROFILE_ID}"]`).click();

    await expect(page).toHaveURL(new RegExp(`/profiles/${PROFILE_ID}$`), {
      timeout: 15_000,
    });
    await expect(page.getByRole("heading", { name: "Profile detail", exact: true })).toBeVisible({
      timeout: 15_000,
    });

    const profileDetailMain = page.getByRole("main");
    await expect(profileDetailMain).toContainText("Trust score", {
      timeout: 15_000,
    });
    await expect(profileDetailMain).toContainText("Risk score");
    await expect(profileDetailMain).toContainText("Current profile safety status: Active.");
    await expect(profileDetailMain).toContainText("Profile enforcement");

    await page.getByLabel(/Restrict profile/).check();
    await page.getByLabel("Enforcement reason").fill(
      "E2E verified repeated unsafe marketplace behavior with safe admin-only context.",
    );

    const enforcementResponsePromise = page.waitForResponse((response) => {
      return (
        response.url().includes(`/api/v1/admin/profiles/${PROFILE_ID}/enforcement`) &&
        response.request().method().toUpperCase() === "POST"
      );
    });

    await page.getByRole("button", { name: "Apply profile enforcement", exact: true }).click();

    const enforcementResponse = await enforcementResponsePromise;
    expect(enforcementResponse.ok(), await enforcementResponse.text()).toBe(true);

    await expect(
      page.getByText("Profile enforcement applied. Audit event id: audit-profile-enforcement-e2e", {
        exact: true,
      }),
    ).toBeVisible({
      timeout: 15_000,
    });
    await expect(profileDetailMain).toContainText(/Current profile safety status: restricted\./i);

    await expectNoTrustOpsSensitiveLeak(page);
  });

  test("admin can inspect safe audit metadata and resource links without raw private fields", async ({ page }) => {
    const state = createTrustOpsState();

    await installTrustOpsMocks(page, state);

    await page.goto("/audit", { waitUntil: "domcontentloaded" });

    await expect(page.getByText("Safe audit visibility for admin actions.")).toBeVisible({
      timeout: 15_000,
    });
    const auditEvent = page.locator("article").filter({ hasText: "Admin Profile Enforcement Applied" });
    await expect(auditEvent).toBeVisible();
    await expect(auditEvent).toContainText(`profile · ${PROFILE_ID}`);
    await expect(auditEvent).toContainText("Profile Id");
    await expect(auditEvent).toContainText(PROFILE_ID);

    await expect(auditEvent.locator(`a[href="/moderation/${CASE_ID}"]`)).toBeVisible();
    await expect(auditEvent.locator(`a[href="/listings/${LISTING_ID}"]`)).toBeVisible();

    await expectNoTrustOpsSensitiveLeak(page);
  });

  test("admin can review conversation summaries and safe message previews without raw body leaks", async ({ page }) => {
    const state = createTrustOpsState();

    await installTrustOpsMocks(page, state);

    await page.goto("/conversations", { waitUntil: "domcontentloaded" });

    const conversationCard = page.locator("article").filter({ hasText: CONVERSATION_ID });
    await expect(conversationCard).toBeVisible({
      timeout: 15_000,
    });
    await expect(conversationCard).toContainText("Trust Ops Buyer ↔ Trust Ops Seller");
    await expect(conversationCard).toContainText("Trust Ops stroller listing");
    await expect(conversationCard.locator(`a[href="/conversations/${CONVERSATION_ID}"]`)).toBeVisible();

    await expectNoTrustOpsSensitiveLeak(page);

    await conversationCard.locator(`a[href="/conversations/${CONVERSATION_ID}"]`).click();

    await expect(page).toHaveURL(new RegExp(`/conversations/${CONVERSATION_ID}$`), {
      timeout: 15_000,
    });
    await expect(page.getByRole("main")).toContainText("Trust Ops Buyer", {
      timeout: 15_000,
    });
    await expect(page.getByRole("main")).toContainText("Trust Ops Seller");
    await expect(page.getByRole("main")).toContainText("Can we meet near metro? [redacted-phone]");
    await expect(page.getByRole("main").locator(`a[href="/moderation/${CASE_ID}"]`).first()).toBeVisible();

    await expectNoTrustOpsSensitiveLeak(page);
  });
});

async function installTrustOpsMocks(page: Page, state: TrustOpsState): Promise<void> {
  await installBackofficeAuthMocks(page);
  await installProfileMocks(page, state);
  await installAuditMocks(page, state);
  await installConversationMocks(page, state);
}

async function installBackofficeAuthMocks(page: Page): Promise<void> {
  await page.route("**/auth/backoffice/me**", async (route) => {
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

  await page.route("**/auth/backoffice/csrf**", async (route) => {
    await fulfillJson(route, {
      ok: true,
      data: {
        csrfToken: "backoffice-trust-ops-e2e-csrf",
      },
    });
  });
}

async function installProfileMocks(page: Page, state: TrustOpsState): Promise<void> {
  await page.route("**/api/v1/admin/profiles**", async (route) => {
    if (await fulfillOptions(route)) {
      return;
    }

    const request = route.request();
    const url = new URL(request.url());
    const method = request.method().toUpperCase();

    if (method === "GET" && url.pathname === "/api/v1/admin/profiles") {
      await fulfillJson(route, {
        ok: true,
        data: {
          profiles: [state.profile],
        },
      });
      return;
    }

    if (method === "GET" && url.pathname === `/api/v1/admin/profiles/${PROFILE_ID}`) {
      await fulfillJson(route, {
        ok: true,
        data: {
          profile: state.profileDetail,
        },
      });
      return;
    }

    if (method === "POST" && url.pathname === `/api/v1/admin/profiles/${PROFILE_ID}/enforcement`) {
      const body = (await request.postDataJSON()) as {
        action?: string;
        reason?: string;
      };

      expect(body).toEqual(
        expect.objectContaining({
          action: "profile_restrict",
          reason: expect.stringContaining("E2E verified"),
        }),
      );

      state.profileDetail = {
        ...state.profileDetail,
        safetyStatus: "restricted",
        trustSnapshot: {
          ...state.profileDetail.trustSnapshot,
          safetyStatus: "restricted",
          recentEnforcementCount: state.profileDetail.trustSnapshot.recentEnforcementCount + 1,
        },
      };

      await fulfillJson(route, {
        ok: true,
        data: {
          profile: state.profileDetail,
          enforcement: {
            profileId: PROFILE_ID,
            action: "profile_restrict",
            previousSafetyStatus: "active",
            nextSafetyStatus: "restricted",
            moderationActionId: "moderation-action-profile-enforcement-e2e",
            auditEventId: "audit-profile-enforcement-e2e",
          },
        },
      });
      return;
    }

    await fulfillUnhandled(route);
  });
}

async function installAuditMocks(page: Page, state: TrustOpsState): Promise<void> {
  await page.route("**/api/v1/admin/audit/events**", async (route) => {
    if (await fulfillOptions(route)) {
      return;
    }

    const request = route.request();
    const url = new URL(request.url());

    if (request.method().toUpperCase() === "GET" && url.pathname === "/api/v1/admin/audit/events") {
      await fulfillJson(route, {
        ok: true,
        data: {
          events: state.auditEvents,
        },
      });
      return;
    }

    await fulfillUnhandled(route);
  });
}

async function installConversationMocks(page: Page, state: TrustOpsState): Promise<void> {
  await page.route("**/api/v1/admin/conversations**", async (route) => {
    if (await fulfillOptions(route)) {
      return;
    }

    const request = route.request();
    const url = new URL(request.url());
    const method = request.method().toUpperCase();

    if (method === "GET" && url.pathname === "/api/v1/admin/conversations") {
      await fulfillJson(route, {
        ok: true,
        data: {
          conversations: [state.conversation],
        },
      });
      return;
    }

    if (method === "GET" && url.pathname === `/api/v1/admin/conversations/${CONVERSATION_ID}`) {
      await fulfillJson(route, {
        ok: true,
        data: {
          conversation: state.conversationDetail,
        },
      });
      return;
    }

    await fulfillUnhandled(route);
  });
}

type TrustOpsState = ReturnType<typeof createTrustOpsState>;

function createTrustOpsState() {
  const now = "2026-01-01T10:00:00.000Z";

  const trustSnapshot = {
    profileId: PROFILE_ID,
    trustScore: 42,
    riskScore: 91,
    riskLevel: "critical",
    safetyStatus: "active",
    openCaseCount: 2,
    totalCaseCount: 5,
    recentReportCount: 3,
    recentEnforcementCount: 1,
    sensitiveAccessCount: 0,
    aiSummaryCount: 2,
    lastReportAt: now,
    lastEnforcementAt: now,
    computedAt: now,
  };

  const profile = {
    profileId: PROFILE_ID,
    displayName: "Trust Ops Parent",
    locationCity: "İstanbul",
    safetyStatus: "active",
    createdAt: now,
    updatedAt: now,
    listingCount: 3,
    trustSnapshot,
    email: RAW_EMAIL_SENTINEL,
    phone: RAW_PHONE_SENTINEL,
    accessToken: RAW_TOKEN_SENTINEL,
  };

  const profileDetail = {
    ...profile,
    stats: {
      totalListings: 3,
      activeListings: 2,
      archivedListings: 1,
      soldListings: 0,
      reservedListings: 0,
      draftListings: 0,
      totalCases: 5,
      openCases: 2,
      enforcementActions: 1,
    },
    listings: [
      {
        listingId: LISTING_ID,
        title: "Trust Ops stroller listing",
        status: "active",
        listingType: "sale",
        condition: "good",
        price: {
          amount: "6500.00",
          currency: "TRY",
        },
        category: {
          id: "category-trust-ops-e2e",
          name: "Bebek Arabaları",
          slug: "bebek-arabalari",
        },
        createdAt: now,
        updatedAt: now,
      },
    ],
    relatedModerationCases: [
      {
        caseId: CASE_ID,
        reportId: "report-trust-ops-e2e-1",
        targetType: "profile",
        targetId: PROFILE_ID,
        status: "in_review",
        priority: "high",
        reason: "unsafe_behavior",
        createdAt: now,
        updatedAt: now,
      },
    ],
    enforcementHistory: [
      {
        actionId: "moderation-action-trust-ops-e2e-1",
        caseId: CASE_ID,
        actionType: "profile_warn",
        createdAt: now,
      },
    ],
  };

  const buyer = {
    profileId: "profile-trust-ops-buyer-e2e",
    displayName: "Trust Ops Buyer",
    safetyStatus: "active",
    email: RAW_EMAIL_SENTINEL,
    phone: RAW_PHONE_SENTINEL,
  };

  const seller = {
    profileId: PROFILE_ID,
    displayName: "Trust Ops Seller",
    safetyStatus: "restricted",
    email: RAW_EMAIL_SENTINEL,
    phone: RAW_PHONE_SENTINEL,
  };

  const latestMessage = {
    messageId: MESSAGE_ID,
    sender: buyer,
    senderProfileId: buyer.profileId,
    bodyPreview: "Can we meet near metro? [redacted-phone]",
    isHidden: false,
    createdAt: now,
    reportCount: 1,
    openCaseCount: 1,
    enforcementCount: 0,
    rawBody: RAW_MESSAGE_SENTINEL,
  };

  const conversation = {
    conversationId: CONVERSATION_ID,
    status: "active",
    participants: [buyer, seller],
    contextListing: {
      listingId: LISTING_ID,
      title: "Trust Ops stroller listing",
      status: "active",
    },
    latestMessage,
    messageCount: 2,
    reportedMessageCount: 1,
    openCaseCount: 1,
    enforcementCount: 1,
    lastMessageAt: now,
    email: RAW_EMAIL_SENTINEL,
    phone: RAW_PHONE_SENTINEL,
  };

  const conversationDetail = {
    ...conversation,
    messages: [
      {
        ...latestMessage,
        moderationStatus: "reported",
      },
      {
        messageId: "message-trust-ops-e2e-2",
        sender: seller,
        senderProfileId: seller.profileId,
        bodyPreview: "I can share safe pickup details here.",
        isHidden: false,
        createdAt: now,
        reportCount: 0,
        openCaseCount: 0,
        enforcementCount: 1,
        moderationStatus: "reviewed",
        rawBody: RAW_MESSAGE_SENTINEL,
      },
    ],
    relatedModerationCases: [
      {
        caseId: CASE_ID,
        reportId: "report-trust-ops-e2e-2",
        targetType: "message",
        targetId: MESSAGE_ID,
        status: "in_review",
        priority: "high",
        reason: "suspicious_message",
        createdAt: now,
        updatedAt: now,
        rawReason: RAW_REPORT_SENTINEL,
      },
    ],
    enforcementHistory: [
      {
        actionId: "moderation-action-message-e2e-1",
        caseId: CASE_ID,
        messageId: MESSAGE_ID,
        actionType: "message_mark_reviewed",
        createdAt: now,
      },
    ],
  };

  return {
    profile,
    profileDetail,
    auditEvents: [
      {
        id: "audit-profile-enforcement-e2e",
        eventType: "admin_profile_enforcement_applied",
        entityType: "profile",
        entityId: PROFILE_ID,
        actorProfileId: ADMIN_AUTH.user.profileId,
        createdAt: now,
        metadata: {
          profileId: PROFILE_ID,
          caseId: CASE_ID,
          listingId: LISTING_ID,
          action: "profile_restrict",
          previousSafetyStatus: "active",
          nextSafetyStatus: "restricted",
          reasonLength: 74,
        },
        rawReason: RAW_REPORT_SENTINEL,
        email: RAW_EMAIL_SENTINEL,
        phone: RAW_PHONE_SENTINEL,
        token: RAW_TOKEN_SENTINEL,
      },
    ],
    conversation,
    conversationDetail,
  };
}

async function expectNoTrustOpsSensitiveLeak(page: Page): Promise<void> {
  await expect(page.getByText(RAW_EMAIL_SENTINEL, { exact: true })).toHaveCount(0);
  await expect(page.getByText(RAW_PHONE_SENTINEL, { exact: true })).toHaveCount(0);
  await expect(page.getByText(RAW_TOKEN_SENTINEL, { exact: true })).toHaveCount(0);
  await expect(page.getByText(RAW_MESSAGE_SENTINEL, { exact: true })).toHaveCount(0);
  await expect(page.getByText(RAW_REPORT_SENTINEL, { exact: true })).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("<script");
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

async function fulfillJson(route: Route, body: ApiResponse<unknown>, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: getCorsHeaders(route),
    body: JSON.stringify(body),
  });
}

async function fulfillUnhandled(route: Route): Promise<void> {
  await fulfillJson(
    route,
    {
      ok: false,
      error: {
        code: "UNHANDLED_BACKOFFICE_TRUST_OPS_E2E_ROUTE",
        message: `${route.request().method()} ${new URL(route.request().url()).pathname}`,
      },
    },
    404,
  );
}

function getCorsHeaders(route: Route): Record<string, string> {
  const origin = route.request().headers()["origin"] ?? "http://localhost:3001";

  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "authorization,content-type,x-babyloop-csrf-token",
    vary: "Origin",
  };
}
