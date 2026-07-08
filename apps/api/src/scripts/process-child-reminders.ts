import { createApp } from "../app.js";
import {
  processDueChildReminderNotifications,
  type ChildReminderDeliveryChannel,
  type ProcessDueChildRemindersInput
} from "../services/child-reminder-scheduler.service.js";

async function main(): Promise<void> {
  const app = createApp();
  const dryRun = process.env.CHILD_REMINDER_PROCESSOR_DRY_RUN !== "false";
  const limit = readPositiveInteger("CHILD_REMINDER_PROCESSOR_LIMIT", 50);
  const channels = readDeliveryChannels(process.env.CHILD_REMINDER_DELIVERY_CHANNELS);

  try {
    await app.ready();
    assertDatabaseConfigured(app);

    const input: ProcessDueChildRemindersInput = {
      dryRun,
      limit
    };

    if (channels) {
      input.channels = channels;
    }

    const summary = await processDueChildReminderNotifications(app, input);

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
  } finally {
    await app.close();
  }
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
