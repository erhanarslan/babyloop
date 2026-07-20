import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getRuntimeWorkerHeartbeat,
  markRuntimeWorkerCompleted,
  markRuntimeWorkerFailed,
  markRuntimeWorkerStarted
} from "../src/services/runtime-worker-heartbeat.service.js";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { resetTestDatabase } from "./helpers/db.js";

let app!: TestApp;

beforeEach(async () => {
  await resetTestDatabase();
  app = await createTestApp();
});

afterEach(async () => {
  await app.close();
});

describe("runtime worker heartbeat service", () => {
  it("records running and completed worker cycles with allowlisted summaries", async () => {
    await markRuntimeWorkerStarted(app, {
      workerName: "notification_delivery",
      workerId: "worker@example/1"
    });

    expect(await getRuntimeWorkerHeartbeat(app, "notification_delivery")).toMatchObject({
      workerName: "notification_delivery",
      workerId: "worker-example-1",
      status: "running",
      lastErrorCode: null
    });

    await markRuntimeWorkerCompleted(app, {
      workerName: "notification_delivery",
      workerId: "worker@example/1",
      summary: {
        processed: 4,
        sent: 2,
        aborted: false,
        unsafe_nested: { token: "secret" },
        "unsafe-key!": "ignored"
      }
    });

    const completed = await getRuntimeWorkerHeartbeat(app, "notification_delivery");
    expect(completed).toMatchObject({
      status: "idle",
      lastSummary: {
        processed: 4,
        sent: 2,
        aborted: false
      }
    });
    expect(JSON.stringify(completed)).not.toContain("secret");
  });

  it("stores redacted worker failures", async () => {
    await markRuntimeWorkerStarted(app, {
      workerName: "child_reminder",
      workerId: "child-worker"
    });

    await markRuntimeWorkerFailed(app, {
      workerName: "child_reminder",
      workerId: "child-worker",
      error: Object.assign(
        new Error("postgresql://admin:password@localhost/db token=raw-token"),
        { code: "ECONNREFUSED" }
      )
    });

    const failed = await getRuntimeWorkerHeartbeat(app, "child_reminder");
    expect(failed).toMatchObject({
      status: "failed",
      lastErrorCode: "ECONNREFUSED"
    });
    expect(JSON.stringify(failed)).not.toContain("admin:password");
    expect(JSON.stringify(failed)).not.toContain("raw-token");
  });
});
