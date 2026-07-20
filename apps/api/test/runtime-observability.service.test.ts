import { describe, expect, it, vi } from "vitest";
import {
  buildSafeErrorPayload,
  createRuntimeObservability
} from "../src/services/runtime-observability.service.js";
import { RuntimeMetricsRegistry } from "../src/services/runtime-metrics.service.js";

describe("runtime observability", () => {
  it("redacts secrets and query strings from external error payloads", () => {
    const payload = buildSafeErrorPayload(
      new Error("DATABASE_URL=postgresql://admin:secret@db.example.test/app token=raw-token"),
      {
        event: "api_request_failed",
        requestId: "req-1",
        method: "GET",
        route: "/api/v1/listings?token=raw-token",
        statusCode: 500
      },
      {
        NODE_ENV: "production",
        OBSERVABILITY_SERVICE_NAME: "babyloop-api"
      }
    );

    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("admin:secret");
    expect(serialized).not.toContain("raw-token");
    expect(serialized).not.toContain("?token=");
    expect(payload).toMatchObject({
      service: "babyloop-api",
      environment: "production",
      context: {
        event: "api_request_failed",
        requestId: "req-1",
        method: "GET",
        route: "/api/v1/listings",
        statusCode: 500
      }
    });
  });

  it("sends a bounded webhook report without propagating provider failures", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 503 }));
    const metrics = new RuntimeMetricsRegistry();
    const observability = createRuntimeObservability({
      env: {
        NODE_ENV: "test",
        OBSERVABILITY_ERROR_WEBHOOK_URL: "http://127.0.0.1:9999/runtime-errors",
        OBSERVABILITY_ERROR_WEBHOOK_TOKEN: "webhook-secret-token",
        OBSERVABILITY_ERROR_REPORT_TIMEOUT_MS: "500"
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      metrics
    });

    await expect(observability.captureException(new Error("provider failed"), {
      event: "notification_worker_failed",
      workerName: "notification_delivery",
      workerId: "worker-1"
    })).resolves.toBeUndefined();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const call = fetchImpl.mock.calls[0];
    expect(call?.[0]).toBe("http://127.0.0.1:9999/runtime-errors");
    expect((call?.[1] as RequestInit).headers).toMatchObject({
      authorization: "Bearer webhook-secret-token",
      "content-type": "application/json"
    });
    expect(metrics.renderPrometheus()).toContain("babyloop_api_error_report_failures_total 1");
  });
});
