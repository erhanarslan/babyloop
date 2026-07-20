import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { createApp } from "../app.js";
import { processPendingNotificationProviderDeliveries } from "../services/notification-provider-execution.service.js";
import { createRuntimeObservability } from "../services/runtime-observability.service.js";
import {
  markRuntimeWorkerCompleted,
  markRuntimeWorkerFailed,
  markRuntimeWorkerStarted
} from "../services/runtime-worker-heartbeat.service.js";

async function main(): Promise<void> {
  const observability = createRuntimeObservability();
  const app = createApp({ observability });
  const abortController = new AbortController();
  const workerId = buildWorkerId();
  let heartbeatStarted = false;
  const stop = (signal: NodeJS.Signals) => {
    if (!abortController.signal.aborted) {
      app.log.info({ signal, workerId }, "Notification provider worker shutdown requested.");
      abortController.abort(new Error(`Worker received ${signal}.`));
    }
  };
  const onSigterm = () => stop("SIGTERM");
  const onSigint = () => stop("SIGINT");

  process.once("SIGTERM", onSigterm);
  process.once("SIGINT", onSigint);

  try {
    await app.ready();
    assertDatabaseConfigured(app);
    await markRuntimeWorkerStarted(app, {
      workerName: "notification_delivery",
      workerId
    });
    heartbeatStarted = true;

    const limit = readPositiveInteger(process.env.NOTIFICATION_PROVIDER_PROCESS_LIMIT, 50);
    const claimTtlMs = readPositiveInteger(process.env.NOTIFICATION_PROVIDER_CLAIM_TTL_MS, 5 * 60 * 1000);
    const summary = await processPendingNotificationProviderDeliveries(app, {
      limit,
      claimTtlMs,
      workerId,
      signal: abortController.signal
    });

    await markRuntimeWorkerCompleted(app, {
      workerName: "notification_delivery",
      workerId,
      summary: {
        processed: summary.processed,
        claimed: summary.claimed,
        duplicates: summary.duplicates,
        staleRecovered: summary.staleRecovered,
        sent: summary.sent,
        skipped: summary.skipped,
        failed: summary.failed,
        retryScheduled: summary.retryScheduled,
        aborted: abortController.signal.aborted
      }
    });

    console.log(JSON.stringify({
      workerId,
      processed: summary.processed,
      claimed: summary.claimed,
      duplicates: summary.duplicates,
      staleRecovered: summary.staleRecovered,
      sent: summary.sent,
      skipped: summary.skipped,
      failed: summary.failed,
      retryScheduled: summary.retryScheduled,
      providerCallsAllowed: summary.providerCallsAllowed,
      aborted: abortController.signal.aborted
    }));
  } catch (error) {
    if (heartbeatStarted) {
      await markRuntimeWorkerFailed(app, {
        workerName: "notification_delivery",
        workerId,
        error
      }).catch(() => undefined);
    }

    await observability.captureException(error, {
      event: "notification_worker_failed",
      workerName: "notification_delivery",
      workerId
    });
    throw error;
  } finally {
    process.off("SIGTERM", onSigterm);
    process.off("SIGINT", onSigint);
    await app.close();
  }
}

function buildWorkerId(): string {
  const configured = process.env.NOTIFICATION_PROVIDER_WORKER_ID?.trim();

  if (configured) {
    return configured.slice(0, 120);
  }

  return `${hostname()}-${process.pid}-${randomUUID().slice(0, 8)}`.slice(0, 120);
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function assertDatabaseConfigured(app: ReturnType<typeof createApp>): void {
  if (!("db" in app) || !app.db) {
    throw new Error("DATABASE_URL is required to run this notification processor script.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Notification provider processing failed.");
  process.exit(1);
});
