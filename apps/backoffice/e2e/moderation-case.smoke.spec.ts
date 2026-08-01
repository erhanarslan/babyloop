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

type AdminModerationCaseStatus = "pending" | "in_review" | "resolved" | "dismissed";
type AdminModerationTargetType = "listing" | "profile" | "message";
type AdminModerationActionType =
  | "note"
  | "review_started"
  | "dismissed"
  | "resolved"
  | "action_taken";
type AdminModerationEnforcementAction =
  | "listing_hide"
  | "listing_restore"
  | "message_hide"
  | "message_mark_reviewed"
  | "profile_warn"
  | "profile_restrict"
  | "profile_suspend"
  | "profile_restore";
type AdminSensitiveAccessField = "reporter" | "message";

type RawAdminTargetPreview =
  | {
      type: "listing";
      id: string;
      title: string;
      status: string;
    }
  | {
      type: "profile";
      id: string;
      displayName: string;
      safetyStatus: "active" | "restricted" | "suspended";
    }
  | {
      type: "message";
      id: string;
      bodyPreview: string;
      createdAt: string;
    };

type RawAdminModerationCase = {
  id: string;
  targetType: AdminModerationTargetType;
  targetId: string;
  status: AdminModerationCaseStatus;
  priority: "low" | "normal" | "high";
  createdAt: string;
  updatedAt: string;
  report: {
    id: string;
    reason: string;
    status: string;
    createdAt: string;
    reporter: {
      redacted: true;
    } | null;
  } | null;
  targetPreview: RawAdminTargetPreview | null;
};

type RawAdminModerationAction = {
  id: string;
  actionType: string;
  note: string | null;
  createdAt: string;
  actorProfile: {
    id: string;
    displayName: string;
  } | null;
};

type AdminModerationTimelineItem = {
  id: string;
  type:
    | "audit_event"
    | "case_created"
    | "moderation_action"
    | "note"
    | "report_received"
    | "sensitive_access_denied"
    | "sensitive_access_granted"
    | "status_change";
  label: string;
  createdAt: string;
  actor: {
    id: string;
    displayName: string | null;
  } | null;
  metadata?: Record<string, string | number | boolean | string[] | null>;
  note?: string | null;
};

type MockState = {
  moderationCase: RawAdminModerationCase;
  actions: RawAdminModerationAction[];
  timeline: AdminModerationTimelineItem[];
  actionRequests: Array<{
    actionType: AdminModerationActionType;
    note: string;
  }>;
  enforcementRequests: Array<{
    action: AdminModerationEnforcementAction;
    reason: string;
  }>;
  sensitiveAccessRequests: Array<{
    fields: AdminSensitiveAccessField[];
    reason: string;
  }>;
};

const ADMIN_AUTH = {
  user: {
    id: "admin-moderation-e2e",
    email: "admin-moderation-e2e@babyloop.test",
    role: "admin",
    emailVerifiedAt: "2026-01-01T00:00:00.000Z",
    profileId: "admin-profile-moderation-e2e",
    displayName: "Backoffice Moderation Admin",
    locationCity: "İstanbul",
  },
};

const CASE_ID = "mod-case-e2e-1";
const TARGET_MESSAGE_ID = "message-target-e2e-1";
const RAW_MESSAGE_BODY = "RAW_PRIVATE_MESSAGE_BODY_E2E";
const REPORTER_EMAIL = "reporter-moderation-e2e@babyloop.test";

test.describe("backoffice moderation case review", () => {
  test("admin can open a redacted case, add an action, apply enforcement, and request sensitive access", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    const state = createModerationState();

    await installBackofficeMocks(page, state);

    await page.goto("/moderation", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Moderasyon vakaları", exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByLabel("Moderasyon öncelik özeti")).toBeVisible();
    await expect(page.getByText("Güvensiz mesaj", { exact: true })).toBeVisible();
    await expect(page.getByText(`Mesaj önizlemesi: ${TARGET_MESSAGE_ID} preview`, { exact: true })).toBeVisible();

    await expect(page.getByText(RAW_MESSAGE_BODY, { exact: true })).toHaveCount(0);
    await expect(page.getByText(REPORTER_EMAIL, { exact: true })).toHaveCount(0);

    await page.getByRole("link", { name: "Vakayı aç", exact: true }).click();

    await expect(page).toHaveURL(new RegExp(`/moderation/${CASE_ID}$`), {
      timeout: 15_000,
    });
    await expect(page.getByRole("heading", { name: "Vaka mod-case", exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Moderasyon vakası", { exact: true })).toBeVisible();
    await expect(page.getByRole("term").filter({ hasText: "Hedef türü" })).toBeVisible();
    await expect(page.getByText("Mesaj", { exact: true })).toBeVisible();
    await expect(page.getByText(`Mesaj önizlemesi: ${TARGET_MESSAGE_ID} preview`, { exact: true })).toBeVisible();

    await expect(page.getByRole("heading", { name: "Vaka zaman çizelgesi", exact: true })).toBeVisible();
    await expect(page.getByText("Vaka oluşturuldu", { exact: true })).toBeVisible();
    await expect(page.getByText("Şikâyet alındı", { exact: true })).toBeVisible();

    await expect(page.getByText(RAW_MESSAGE_BODY, { exact: true })).toHaveCount(0);
    await expect(page.getByText(REPORTER_EMAIL, { exact: true })).toHaveCount(0);
    await expect(page.getByText("Henüz AI özeti oluşturulmadı.", { exact: true })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByLabel("İşlem türü").selectOption("review_started");
    await page
      .getByLabel("Yönetici notu")
      .fill("Starting review from moderation E2E smoke flow.");

    const actionResponsePromise = page.waitForResponse((response) => {
      return (
        response.url().includes(`/api/v1/admin/moderation/cases/${CASE_ID}/actions`) &&
        response.request().method() === "POST"
      );
    });

    await page.getByRole("button", { name: "İşlem ekle", exact: true }).click();

    const actionResponse = await actionResponsePromise;
    expect(actionResponse.ok(), await actionResponse.text()).toBe(true);
    expect(state.actionRequests).toEqual([
      {
        actionType: "review_started",
        note: "Starting review from moderation E2E smoke flow.",
      },
    ]);

    await expect(page.getByText("İşlem eklendi.", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByText("Starting review from moderation E2E smoke flow.", { exact: true }),
    ).toBeVisible();

    await page.getByLabel("Mesajı incelendi olarak işaretle").check();
    await page
      .getByLabel("Yaptırım nedeni")
      .fill("Message content has been reviewed by trust and safety.");

    const enforcementResponsePromise = page.waitForResponse((response) => {
      return (
        response.url().includes(`/api/v1/admin/moderation/cases/${CASE_ID}/enforcement`) &&
        response.request().method() === "POST"
      );
    });

    await page.getByRole("button", { name: "Yaptırım işlemini uygula", exact: true }).click();

    const enforcementResponse = await enforcementResponsePromise;
    expect(enforcementResponse.ok(), await enforcementResponse.text()).toBe(true);
    expect(state.enforcementRequests).toEqual([
      {
        action: "message_mark_reviewed",
        reason: "Message content has been reviewed by trust and safety.",
      },
    ]);

    await expect(
      page.getByText("Yaptırım uygulandı. Denetim olayı: audit-enforcement-e2e-1", {
        exact: true,
      }),
    ).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByText("Message content has been reviewed by trust and safety.", { exact: true }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Hassas erişim iste", exact: true }).click();
    await page
      .getByLabel("Erişim nedeni")
      .fill("Need raw context to verify the reported message.");
    await page.getByLabel("Şikâyetçi kimliği").check();
    await page.getByLabel("Ham ileti gövdesi").check();

    const sensitiveAccessResponsePromise = page.waitForResponse((response) => {
      return (
        response.url().includes(`/api/v1/admin/moderation/cases/${CASE_ID}/sensitive-access`) &&
        response.request().method() === "POST"
      );
    });

    await page.getByRole("button", { name: "Hassas erişim isteğini gönder", exact: true }).click();

    const sensitiveAccessResponse = await sensitiveAccessResponsePromise;
    expect(sensitiveAccessResponse.ok(), await sensitiveAccessResponse.text()).toBe(true);
    expect(state.sensitiveAccessRequests).toEqual([
      {
        reason: "Need raw context to verify the reported message.",
        fields: ["reporter", "message"],
      },
    ]);

    await expect(page.getByRole("heading", { name: "Hassas erişim verildi", exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Denetim olayı: audit-sensitive-access-e2e-1", { exact: true })).toBeVisible();
    await expect(page.getByText(REPORTER_EMAIL, { exact: true })).toBeVisible();
    await expect(page.getByText(RAW_MESSAGE_BODY, { exact: true })).toBeVisible();
  });
});

async function installBackofficeMocks(page: Page, state: MockState): Promise<void> {
  await page.route("**/auth/backoffice/refresh**", async (route) => {
    await fulfillJson(route, {
      ok: true,
      data: ADMIN_AUTH,
    });
  });

  await page.route("**/auth/backoffice/me**", async (route) => {
    await fulfillJson(route, {
      ok: true,
      data: ADMIN_AUTH,
    });
  });

  await page.route("**/auth/backoffice/csrf**", async (route) => {
    await fulfillJson(route, {
      ok: true,
      data: {
        csrfToken: "backoffice-moderation-e2e-csrf",
      },
    });
  });

  await page.route("**/admin/moderation**", async (route) => {
    if (await fulfillOptions(route)) {
      return;
    }

    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "GET" && pathEndsWith(url, "/admin/moderation/cases")) {
      await fulfillJson(route, {
        ok: true,
        data: {
          cases: [state.moderationCase],
          summary: {
            total: 1,
            byStatus: {
              pending: state.moderationCase.status === "pending" ? 1 : 0,
              inReview: state.moderationCase.status === "in_review" ? 1 : 0,
              resolved: state.moderationCase.status === "resolved" ? 1 : 0,
              dismissed: state.moderationCase.status === "dismissed" ? 1 : 0,
            },
            byTargetType: {
              listing: state.moderationCase.targetType === "listing" ? 1 : 0,
              profile: state.moderationCase.targetType === "profile" ? 1 : 0,
              message: state.moderationCase.targetType === "message" ? 1 : 0,
            },
          },
        },
      });
      return;
    }

    if (
      request.method() === "GET" &&
      pathEndsWith(url, `/admin/moderation/cases/${CASE_ID}/insights`)
    ) {
      await fulfillJson(route, {
        ok: true,
        data: {
          caseId: CASE_ID,
          insights: createCaseInsights(),
        },
      });
      return;
    }

    if (
      request.method() === "GET" &&
      pathEndsWith(url, `/admin/moderation/cases/${CASE_ID}/ai-summaries`)
    ) {
      await fulfillJson(route, {
        ok: true,
        data: {
          caseId: CASE_ID,
          summaries: [],
        },
      });
      return;
    }

    if (
      request.method() === "GET" &&
      pathEndsWith(url, `/admin/moderation/cases/${CASE_ID}`)
    ) {
      await fulfillCaseDetail(route, state);
      return;
    }

    if (
      request.method() === "POST" &&
      pathEndsWith(url, `/admin/moderation/cases/${CASE_ID}/actions`)
    ) {
      const body = (await request.postDataJSON()) as {
        actionType?: AdminModerationActionType;
        note?: string;
      };

      if (!body.actionType || !body.note?.trim()) {
        await fulfillJson(
          route,
          {
            ok: false,
            error: {
              code: "INVALID_REQUEST",
              message: "Moderation action body is invalid.",
            },
          },
          400,
        );
        return;
      }

      const note = body.note.trim();

      state.actionRequests.push({
        actionType: body.actionType,
        note,
      });

      state.actions = [
        {
          id: "moderation-action-e2e-1",
          actionType: body.actionType,
          note,
          createdAt: "2026-01-01T12:05:00.000Z",
          actorProfile: {
            id: "admin-profile-moderation-e2e",
            displayName: "Backoffice Moderation Admin",
          },
        },
        ...state.actions,
      ];
      state.timeline = [
        {
          id: "timeline-action-e2e-1",
          type: "moderation_action",
          label: "Review started",
          createdAt: "2026-01-01T12:05:00.000Z",
          actor: {
            id: "admin-profile-moderation-e2e",
            displayName: "Backoffice Moderation Admin",
          },
          note,
          metadata: {
            actionType: body.actionType,
          },
        },
        ...state.timeline,
      ];
      state.moderationCase = {
        ...state.moderationCase,
        status: "in_review",
        updatedAt: "2026-01-01T12:05:00.000Z",
      };

      await fulfillJson(route, {
        ok: true,
        data: {
          action: state.actions[0],
        },
      });
      return;
    }

    if (
      request.method() === "POST" &&
      pathEndsWith(url, `/admin/moderation/cases/${CASE_ID}/enforcement`)
    ) {
      const body = (await request.postDataJSON()) as {
        action?: AdminModerationEnforcementAction;
        reason?: string;
      };

      if (!body.action || !body.reason?.trim()) {
        await fulfillJson(
          route,
          {
            ok: false,
            error: {
              code: "INVALID_REQUEST",
              message: "Moderation enforcement body is invalid.",
            },
          },
          400,
        );
        return;
      }

      const reason = body.reason.trim();

      state.enforcementRequests.push({
        action: body.action,
        reason,
      });

      state.actions = [
        {
          id: "moderation-action-enforcement-e2e-1",
          actionType: "action_taken",
          note: reason,
          createdAt: "2026-01-01T12:10:00.000Z",
          actorProfile: {
            id: "admin-profile-moderation-e2e",
            displayName: "Backoffice Moderation Admin",
          },
        },
        ...state.actions,
      ];
      state.timeline = [
        {
          id: "timeline-enforcement-e2e-1",
          type: "audit_event",
          label: "Enforcement applied",
          createdAt: "2026-01-01T12:10:00.000Z",
          actor: {
            id: "admin-profile-moderation-e2e",
            displayName: "Backoffice Moderation Admin",
          },
          note: reason,
          metadata: {
            action: body.action,
            auditEventId: "audit-enforcement-e2e-1",
            targetType: "message",
            targetId: TARGET_MESSAGE_ID,
          },
        },
        ...state.timeline,
      ];
      state.moderationCase = {
        ...state.moderationCase,
        updatedAt: "2026-01-01T12:10:00.000Z",
      };

      await fulfillJson(route, {
        ok: true,
        data: {
          caseId: CASE_ID,
          action: body.action,
          targetType: "message",
          targetId: TARGET_MESSAGE_ID,
          resultingStatus: "reviewed",
          moderationActionId: "moderation-action-enforcement-e2e-1",
          auditEventId: "audit-enforcement-e2e-1",
        },
      });
      return;
    }

    if (
      request.method() === "POST" &&
      pathEndsWith(url, `/admin/moderation/cases/${CASE_ID}/sensitive-access`)
    ) {
      const body = (await request.postDataJSON()) as {
        fields?: AdminSensitiveAccessField[];
        reason?: string;
      };

      if (!body.reason?.trim() || !body.fields?.length) {
        await fulfillJson(
          route,
          {
            ok: false,
            error: {
              code: "INVALID_REQUEST",
              message: "Sensitive access request is invalid.",
            },
          },
          400,
        );
        return;
      }

      state.sensitiveAccessRequests.push({
        reason: body.reason.trim(),
        fields: body.fields,
      });

      await fulfillJson(route, {
        ok: true,
        data: {
          caseId: CASE_ID,
          grantedFields: body.fields,
          sensitive: {
            reporter: body.fields.includes("reporter")
              ? {
                  profileId: "reporter-profile-e2e",
                  displayName: "Reporter E2E",
                  email: REPORTER_EMAIL,
                }
              : undefined,
            message: body.fields.includes("message")
              ? {
                  id: TARGET_MESSAGE_ID,
                  body: RAW_MESSAGE_BODY,
                  senderProfileId: "sender-profile-e2e",
                  createdAt: "2026-01-01T10:00:00.000Z",
                }
              : undefined,
          },
          auditEventId: "audit-sensitive-access-e2e-1",
        },
      });
      return;
    }

    await fulfillUnhandled(route);
  });
}

async function fulfillCaseDetail(route: Route, state: MockState): Promise<void> {
  await fulfillJson(route, {
    ok: true,
    data: {
      case: state.moderationCase,
      actions: state.actions,
      timeline: state.timeline,
    },
  });
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
        message: `Unhandled moderation E2E route: ${request.method()} ${url.pathname}`,
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

function pathEndsWith(url: URL, suffix: string): boolean {
  return url.pathname === suffix || url.pathname.endsWith(suffix);
}

function createModerationState(): MockState {
  return {
    moderationCase: {
      id: CASE_ID,
      targetType: "message",
      targetId: TARGET_MESSAGE_ID,
      status: "pending",
      priority: "high",
      createdAt: "2026-01-01T10:00:00.000Z",
      updatedAt: "2026-01-01T10:00:00.000Z",
      report: {
        id: "report-e2e-1",
        reason: "unsafe_message",
        status: "open",
        createdAt: "2026-01-01T10:00:00.000Z",
        reporter: {
          redacted: true,
        },
      },
      targetPreview: {
        type: "message",
        id: TARGET_MESSAGE_ID,
        bodyPreview: `${TARGET_MESSAGE_ID} preview`,
        createdAt: "2026-01-01T09:55:00.000Z",
      },
    },
    actions: [],
    timeline: [
      {
        id: "timeline-case-created-e2e-1",
        type: "case_created",
        label: "Case created",
        createdAt: "2026-01-01T10:00:00.000Z",
        actor: null,
        metadata: {
          targetType: "message",
          targetId: TARGET_MESSAGE_ID,
        },
      },
      {
        id: "timeline-report-received-e2e-1",
        type: "report_received",
        label: "Report received",
        createdAt: "2026-01-01T10:00:00.000Z",
        actor: null,
        metadata: {
          reportId: "report-e2e-1",
        },
      },
    ],
    actionRequests: [],
    enforcementRequests: [],
    sensitiveAccessRequests: [],
  };
}

function createCaseInsights() {
  return {
    caseId: CASE_ID,
    generatedAt: "2026-01-01T10:05:00.000Z",
    targetProfile: {
      profileId: "sender-profile-e2e",
      displayName: "Sender E2E",
      safetyStatus: "active",
      source: "message_sender",
    },
    counts: {
      openCasesForTarget: 1,
      totalCasesForTarget: 1,
      reportsLast7Days: 1,
      reportsLast30Days: 1,
      priorEnforcementActions: 0,
      enforcementActionsLast30Days: 0,
      sensitiveAccessEvents: 0,
      aiSummaryRuns: 0,
      aiSummarySuccesses: 0,
      aiSummaryErrors: 0,
    },
    latestAiSummary: null,
    profileTrustSnapshot: {
      profileId: "sender-profile-e2e",
      trustScore: 88,
      riskScore: 24,
      riskLevel: "medium",
      safetyStatus: "active",
      openCaseCount: 1,
      totalCaseCount: 1,
      recentReportCount: 1,
      recentEnforcementCount: 0,
      sensitiveAccessCount: 0,
      aiSummaryCount: 0,
      lastReportAt: "2026-01-01T10:00:00.000Z",
      lastEnforcementAt: null,
      computedAt: "2026-01-01T10:05:00.000Z",
    },
    risk: {
      score: 42,
      level: "medium",
      signals: ["reported_message", "first_report_for_target"],
    },
    recommendedNextStep: {
      code: "continue_review",
      label: "Continue review",
    },
  };
}
