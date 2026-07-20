import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { resetTestDatabase } from "./helpers/db.js";

const managedEnvNames = [
  "OBSERVABILITY_METRICS_ENABLED",
  "OBSERVABILITY_METRICS_TOKEN",
  "HEALTH_REQUIRE_NOTIFICATION_WORKER",
  "HEALTH_REQUIRE_CHILD_REMINDER_WORKER",
  "HEALTH_FAIL_ON_STALE_NOTIFICATION_CLAIMS",
  "HEALTH_READINESS_TIMEOUT_MS",
  "NOTIFICATION_WORKER_MAX_STALENESS_SECONDS",
  "CHILD_REMINDER_WORKER_MAX_STALENESS_SECONDS",
  "IMAGE_STORAGE_DRIVER"
] as const;
const originalEnv = Object.fromEntries(
  managedEnvNames.map((name) => [name, process.env[name]])
) as Record<(typeof managedEnvNames)[number], string | undefined>;

let app!: TestApp;

beforeEach(async () => {
  for (const name of managedEnvNames) {
    delete process.env[name];
  }
  process.env.IMAGE_STORAGE_DRIVER = "local";
  await resetTestDatabase();
  app = await createTestApp();
});

afterEach(async () => {
  for (const name of managedEnvNames) {
    restoreEnv(name, originalEnv[name]);
  }
  vi.restoreAllMocks();
  await app.close();
});

describe("runtime readiness and metrics", () => {
  it("separates process liveness from dependency readiness", async () => {
    const live = await app.inject({ method: "GET", url: "/health/live" });
    const ready = await app.inject({ method: "GET", url: "/health/ready" });

    expect(live.statusCode).toBe(200);
    expect(live.json()).toMatchObject({
      ok: true,
      live: true,
      service: "babyloop-api"
    });

    expect(ready.statusCode).toBe(200);
    expect(ready.json()).toMatchObject({
      ok: true,
      ready: true,
      expectedDatabaseMigration: "0043_runtime_readiness_observability",
      dependencies: {
        database: { status: "ready", required: true },
        schema: { status: "ready", required: true },
        storage: { status: "ready", required: true },
        ragVectorStore: { status: "not_configured", required: false },
        ragRedis: { status: "not_configured", required: false },
        notificationWorker: { status: "not_configured", required: false },
        childReminderWorker: { status: "not_configured", required: false },
        notificationClaims: { status: "ready" }
      }
    });

    const serialized = `${live.body} ${ready.body}`;
    expect(serialized).not.toMatch(/postgres(?:ql)?:\/\//iu);
    expect(serialized).not.toMatch(/auth_secret|access_key|secret|password|token/iu);
  });

  it("returns 503 when a required worker heartbeat is missing", async () => {
    process.env.HEALTH_REQUIRE_NOTIFICATION_WORKER = "true";

    const response = await app.inject({ method: "GET", url: "/health/ready" });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      ok: false,
      ready: false,
      dependencies: {
        notificationWorker: {
          status: "failed",
          required: true,
          code: "WORKER_HEARTBEAT_MISSING"
        }
      }
    });
  });

  it("keeps Prometheus metrics disabled by default and bearer protected when enabled", async () => {
    const disabled = await app.inject({ method: "GET", url: "/internal/metrics" });
    expect(disabled.statusCode).toBe(404);

    process.env.OBSERVABILITY_METRICS_ENABLED = "true";
    process.env.OBSERVABILITY_METRICS_TOKEN = "runtime-metrics-test-token-1234567890";

    await app.inject({ method: "GET", url: "/health/live" });

    const unauthorized = await app.inject({ method: "GET", url: "/internal/metrics" });
    expect(unauthorized.statusCode).toBe(401);

    const authorized = await app.inject({
      method: "GET",
      url: "/internal/metrics",
      headers: {
        authorization: "Bearer runtime-metrics-test-token-1234567890"
      }
    });

    expect(authorized.statusCode).toBe(200);
    expect(authorized.headers["content-type"]).toContain("text/plain");
    expect(authorized.body).toContain("babyloop_api_http_requests_total");
    expect(authorized.body).toContain("babyloop_api_readiness_checks_total");
    expect(authorized.body).not.toContain("runtime-metrics-test-token");
  });
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
