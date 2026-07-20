import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { createApp } from "../app.js";
import { createRuntimeObservability } from "../services/runtime-observability.service.js";
import {
  markRuntimeWorkerCompleted,
  markRuntimeWorkerFailed,
  markRuntimeWorkerStarted
} from "../services/runtime-worker-heartbeat.service.js";
import {
  processDueChildReminderNotifications,
  type ChildReminderDeliveryChannel,
  type ProcessDueChildRemindersInput
} from "../services/child-reminder-scheduler.service.js";

async function main(): Promise<void> {
  const observability = createRuntimeObservability();
  const app = createApp({ observability });
  const workerId = buildWorkerId();
  let heartbeatStarted = false;
  const dryRun = process.env.CHILD_REMINDER_PROCESSOR_DRY_RUN !== "false";
  const limit = readPositiveInteger("CHILD_REMINDER_PROCESSOR_LIMIT", 50);
  const channels = readDeliveryChannels(process.env.CHILD_REMINDER_DELIVERY_CHANNELS);

  try {
    await app.ready();
    assertDatabaseConfigured(app);
    await markRuntimeWorkerStarted(app, {
      workerName: "child_reminder",
      workerId
    });
    heartbeatStarted = true;

    const input: ProcessDueChildRemindersInput = {
      dryRun,
      limit
    };

    if (channels) {
      input.channels = channels;
    }

    const summary = await processDueChildReminderNotifications(app, input);

    await markRuntimeWorkerCompleted(app, {
      workerName: "child_reminder",
      workerId,
      summary: {
        processed: summary.processed,
        created: summary.created,
        skipped: summary.skipped,
        blocked: summary.blocked,
        dryRun: summary.dryRun,
        providerCallsAllowed: summary.providerCallsAllowed,
        deliveryAllowed: summary.deliveryAllowed
      }
    });

    console.log(JSON.stringify({
      processed: summary.processed,
      created: summary.created,
      skipped: summary.skipped,
      blocked: summary.blocked,
      dryRun: summary.dryRun,
      channels: summary.channels,
      providerCallsAllowed: summary.providerCallsAllowed,
      deliveryAllowed: summary.deliveryAllowed
    }, null, 2));
  } catch (error) {
    if (heartbeatStarted) {
      await markRuntimeWorkerFailed(app, {
        workerName: "child_reminder",
        workerId,
        error
      }).catch(() => undefined);
    }

    await observability.captureException(error, {
      event: "child_reminder_worker_failed",
      workerName: "child_reminder",
      workerId
    });
    throw error;
  } finally {
    await app.close();
  }
}

function buildWorkerId(): string {
  const configured = process.env.CHILD_REMINDER_WORKER_ID?.trim();

  if (configured) {
    return configured.slice(0, 120);
  }

  return `${hostname()}-${process.pid}-${randomUUID().slice(0, 8)}`.slice(0, 120);
}

function readPositiveInteger(name: string, fallback: number): number {
  const raw = process.env[name];

  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readDeliveryChannels(raw: string | undefined): ChildReminderDeliveryChannel[] | undefined {
  if (!raw?.trim()) {
    return undefined;
  }

  const channels = raw
    .split(",")
    .map((item) => item.trim())
    .filter(isSupportedChildReminderDeliveryChannel);

  return channels.length > 0 ? Array.from(new Set(channels)) : undefined;
}

function isSupportedChildReminderDeliveryChannel(value: string): value is ChildReminderDeliveryChannel {
  return value === "in_app" || value === "email_draft" || value === "email" || value === "push" || value === "n8n";
}

function assertDatabaseConfigured(app: ReturnType<typeof createApp>): void {
  if (!("db" in app) || !app.db) {
    throw new Error("DATABASE_URL is required to run this notification processor script.");
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Child reminder processor failed.");
  process.exitCode = 1;
});
