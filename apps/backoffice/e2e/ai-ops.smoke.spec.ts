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

type AdminAiOpsFeature = "moderation_summary" | "listing_image_authenticity";
type AdminAiOpsStatus =
  | "success"
  | "error"
  | "validation_failed"
  | "provider_failed"
  | "skipped";

type AdminAiOpsRunSummary = {
  id: string;
  feature: AdminAiOpsFeature;
  providerName: string;
  modelName: string | null;
  promptVersion: string;
  status: AdminAiOpsStatus;
  caseId: string | null;
  confidenceScore: number | null;
  riskScore: number | null;
  errorSummary: string | null;
  createdAt: string;
};

type MockRun = AdminAiOpsRunSummary & {
  listingId: string | null;
  rawPrompt: string;
  rawOutput: string;
  rawImagePayload: string;
  rawMessageBody: string;
};

type RunRequest = {
  feature: string | null;
  q: string | null;
  status: string | null;
  sort: string | null;
  limit: string | null;
};

type MockState = {
  runs: MockRun[];
  runRequests: RunRequest[];
};

const ADMIN_AUTH = {
  user: {
    id: "admin-ai-ops-e2e",
    email: "admin-ai-ops-e2e@babyloop.test",
    role: "admin",
    emailVerifiedAt: "2026-01-01T00:00:00.000Z",
    profileId: "admin-profile-ai-ops-e2e",
    displayName: "Backoffice AI Ops Admin",
    locationCity: "İstanbul",
  },
};

const IMAGE_RUN_ID = "ai-run-image-authenticity-e2e-1";
const MODERATION_RUN_ID = "ai-run-moderation-summary-e2e-1";
const LISTING_ID = "listing-aiops-e2e-1";

const RAW_PROMPT = "RAW_AI_PROMPT_E2E_SHOULD_NOT_RENDER";
const RAW_OUTPUT = "RAW_AI_OUTPUT_E2E_SHOULD_NOT_RENDER";
const RAW_IMAGE_PAYLOAD = "RAW_IMAGE_PAYLOAD_E2E_SHOULD_NOT_RENDER";
const RAW_MESSAGE_BODY = "RAW_MESSAGE_BODY_E2E_SHOULD_NOT_RENDER";

test.describe("backoffice AI operations", () => {
  test("admin can inspect safe AI run metadata and filter listing image authenticity runs", async ({
    page,
  }) => {
    test.setTimeout(45_000);

    const state = createAiOpsState();

    await installBackofficeMocks(page, state);

    await page.goto("/ai-ops", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "AI çalışma sağlığı", exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByLabel("AI operasyon özeti")).toBeVisible();
    await expect(page.getByText("Çalıştırma 24s", { exact: true })).toBeVisible();
    await expect(page.getByText("Provider / model kırılımı", { exact: true })).toBeVisible();

    const recentRuns = page.locator("section.profile-detail-card.wide");

    await expect(recentRuns.getByRole("heading", { name: "Son güvenli AI çalıştırmaları", exact: true })).toBeVisible();
    await expect(recentRuns.getByText("openai-responses", { exact: true })).toBeVisible();
    await expect(
      recentRuns.getByText("gpt-4.1-mini · moderation_summary.openai.v1", { exact: true }),
    ).toBeVisible();
    await expect(recentRuns.getByText(`Çalıştırma ${MODERATION_RUN_ID}`, { exact: false })).toBeVisible();
    await expect(recentRuns.getByRole("link", { name: "İlgili vakaya git", exact: true })).toHaveAttribute(
      "href",
      "/moderation/mod-case-aiops-e2e-1",
    );

    await expect(page.getByText(RAW_PROMPT, { exact: true })).toHaveCount(0);
    await expect(page.getByText(RAW_OUTPUT, { exact: true })).toHaveCount(0);
    await expect(page.getByText(RAW_IMAGE_PAYLOAD, { exact: true })).toHaveCount(0);
    await expect(page.getByText(RAW_MESSAGE_BODY, { exact: true })).toHaveCount(0);

    const filters = page.locator("form.filter-panel");

    await filters.getByLabel("Özellik").selectOption("listing_image_authenticity");
    await filters.getByLabel("Arama").fill(LISTING_ID);
    await filters.getByLabel("Durum").selectOption("success");

    const filteredRunsResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());

      return (
        url.pathname.endsWith("/admin/ai-ops/runs") &&
        url.searchParams.get("feature") === "listing_image_authenticity" &&
        url.searchParams.get("q") === LISTING_ID &&
        url.searchParams.get("status") === "success" &&
        response.request().method() === "GET"
      );
    });

    await filters.getByRole("button", { name: "Filtrele", exact: true }).click();

    const filteredRunsResponse = await filteredRunsResponsePromise;
    expect(filteredRunsResponse.ok(), await filteredRunsResponse.text()).toBe(true);

    expect(state.runRequests.at(-1)).toEqual({
      feature: "listing_image_authenticity",
      q: LISTING_ID,
      status: "success",
      sort: "newest",
      limit: "50",
    });

    await expect(recentRuns.getByText("gemini-listing-image-authenticity", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      recentRuns.getByText("gemini-2.5-flash · listing_image_authenticity.gemini.v1", { exact: true }),
    ).toBeVisible();
    await expect(recentRuns.getByText(`Çalıştırma ${IMAGE_RUN_ID}`, { exact: false })).toBeVisible();
    await expect(recentRuns.getByText("güven 0.73 · risk 0.18", { exact: true })).toBeVisible();

    await expect(recentRuns.getByText("openai-responses", { exact: true })).toHaveCount(0);
    await expect(recentRuns.getByText("Bu filtrelerle eşleşen AI çalıştırması yok.", { exact: true })).toHaveCount(0);

    await expect(page.getByText(RAW_PROMPT, { exact: true })).toHaveCount(0);
    await expect(page.getByText(RAW_OUTPUT, { exact: true })).toHaveCount(0);
    await expect(page.getByText(RAW_IMAGE_PAYLOAD, { exact: true })).toHaveCount(0);
    await expect(page.getByText(RAW_MESSAGE_BODY, { exact: true })).toHaveCount(0);
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
        csrfToken: "backoffice-ai-ops-e2e-csrf",
      },
    });
  });

  await page.route("**/admin/ai-ops/**", async (route) => {
    if (await fulfillOptions(route)) {
      return;
    }

    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "GET" && pathEndsWith(url, "/admin/ai-ops/summary")) {
      await fulfillJson(route, {
        ok: true,
        data: {
          summary: createAiOpsSummary(state.runs),
        },
      });
      return;
    }

    if (request.method() === "GET" && pathEndsWith(url, "/admin/ai-ops/runs")) {
      state.runRequests.push({
        feature: url.searchParams.get("feature"),
        q: url.searchParams.get("q"),
        status: url.searchParams.get("status"),
        sort: url.searchParams.get("sort"),
        limit: url.searchParams.get("limit"),
      });

      await fulfillJson(route, {
        ok: true,
        data: {
          runs: getFilteredRuns(state, url.searchParams).map(stripRawRunFields),
        },
      });
      return;
    }

    await fulfillUnhandled(route);
  });
}

function createAiOpsState(): MockState {
  return {
    runs: [
      {
        id: MODERATION_RUN_ID,
        feature: "moderation_summary",
        providerName: "openai-responses",
        modelName: "gpt-4.1-mini",
        promptVersion: "moderation_summary.openai.v1",
        status: "success",
        caseId: "mod-case-aiops-e2e-1",
        confidenceScore: 0.82,
        riskScore: 0.41,
        errorSummary: null,
        createdAt: "2026-01-01T11:00:00.000Z",
        listingId: null,
        rawPrompt: RAW_PROMPT,
        rawOutput: RAW_OUTPUT,
        rawImagePayload: RAW_IMAGE_PAYLOAD,
        rawMessageBody: RAW_MESSAGE_BODY,
      },
      {
        id: IMAGE_RUN_ID,
        feature: "listing_image_authenticity",
        providerName: "gemini-listing-image-authenticity",
        modelName: "gemini-2.5-flash",
        promptVersion: "listing_image_authenticity.gemini.v1",
        status: "success",
        caseId: null,
        confidenceScore: 0.73,
        riskScore: 0.18,
        errorSummary: null,
        createdAt: "2026-01-01T12:00:00.000Z",
        listingId: LISTING_ID,
        rawPrompt: RAW_PROMPT,
        rawOutput: RAW_OUTPUT,
        rawImagePayload: RAW_IMAGE_PAYLOAD,
        rawMessageBody: RAW_MESSAGE_BODY,
      },
      {
        id: "ai-run-provider-failed-e2e-1",
        feature: "listing_image_authenticity",
        providerName: "gemini-listing-image-authenticity",
        modelName: "gemini-2.5-flash",
        promptVersion: "listing_image_authenticity.gemini.v1",
        status: "provider_failed",
        caseId: null,
        confidenceScore: null,
        riskScore: null,
        errorSummary: "Provider timeout after safe retry budget.",
        createdAt: "2026-01-01T12:10:00.000Z",
        listingId: "listing-aiops-failed-e2e-1",
        rawPrompt: RAW_PROMPT,
        rawOutput: RAW_OUTPUT,
        rawImagePayload: RAW_IMAGE_PAYLOAD,
        rawMessageBody: RAW_MESSAGE_BODY,
      },
    ],
    runRequests: [],
  };
}

function createAiOpsSummary(runs: MockRun[]) {
  const statusCounts = countByStatus(runs);
  const providerModelCounts = countByProviderModel(runs);

  return {
    totals: {
      totalRuns: runs.length,
      runsLast24Hours: runs.length,
      runsLast7Days: runs.length,
      successRunsLast7Days: runs.filter((run) => run.status === "success").length,
      failedRunsLast7Days: runs.filter((run) => run.status === "error").length,
      providerFailuresLast7Days: runs.filter((run) => run.status === "provider_failed").length,
      validationFailuresLast7Days: runs.filter((run) => run.status === "validation_failed").length,
      skippedRunsLast7Days: runs.filter((run) => run.status === "skipped").length,
    },
    statusCounts,
    providerModelCounts,
    recentRuns: runs.slice(0, 5).map(stripRawRunFields),
  };
}

function countByStatus(runs: MockRun[]) {
  const statuses: AdminAiOpsStatus[] = [
    "success",
    "error",
    "provider_failed",
    "validation_failed",
    "skipped",
  ];

  return statuses
    .map((status) => ({
      status,
      count: runs.filter((run) => run.status === status).length,
    }))
    .filter((item) => item.count > 0);
}

function countByProviderModel(runs: MockRun[]) {
  const groups = new Map<
    string,
    {
      providerName: string;
      modelName: string | null;
      totalRuns: number;
      successRuns: number;
      failedRuns: number;
    }
  >();

  for (const run of runs) {
    const key = `${run.providerName}:${run.modelName ?? "unknown"}`;
    const current =
      groups.get(key) ??
      {
        providerName: run.providerName,
        modelName: run.modelName,
        totalRuns: 0,
        successRuns: 0,
        failedRuns: 0,
      };

    current.totalRuns += 1;

    if (run.status === "success") {
      current.successRuns += 1;
    }

    if (run.status !== "success" && run.status !== "skipped") {
      current.failedRuns += 1;
    }

    groups.set(key, current);
  }

  return Array.from(groups.values());
}

function getFilteredRuns(state: MockState, searchParams: URLSearchParams): MockRun[] {
  const feature = searchParams.get("feature");
  const status = searchParams.get("status");
  const q = searchParams.get("q")?.trim().toLowerCase() ?? "";
  const sort = searchParams.get("sort") ?? "newest";
  const limit = Number(searchParams.get("limit") ?? "50");

  let runs = [...state.runs];

  if (feature) {
    runs = runs.filter((run) => run.feature === feature);
  }

  if (status) {
    runs = runs.filter((run) => run.status === status);
  }

  if (q) {
    runs = runs.filter((run) => {
      return [
        run.id,
        run.caseId,
        run.listingId,
        run.providerName,
        run.modelName,
        run.promptVersion,
      ].some((value) => value?.toLowerCase().includes(q));
    });
  }

  runs.sort((a, b) => {
    const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

    return sort === "oldest" ? diff : -diff;
  });

  return runs.slice(0, Number.isFinite(limit) ? limit : 50);
}

function stripRawRunFields(run: MockRun): AdminAiOpsRunSummary {
  return {
    id: run.id,
    feature: run.feature,
    providerName: run.providerName,
    modelName: run.modelName,
    promptVersion: run.promptVersion,
    status: run.status,
    caseId: run.caseId,
    confidenceScore: run.confidenceScore,
    riskScore: run.riskScore,
    errorSummary: run.errorSummary,
    createdAt: run.createdAt,
  };
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
        message: `Unhandled AI Ops E2E route: ${request.method()} ${url.pathname}`,
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
