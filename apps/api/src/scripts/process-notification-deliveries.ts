import { createApp } from "../app.js";
import { processPendingNotificationProviderDeliveries } from "../services/notification-provider-execution.service.js";

async function main(): Promise<void> {
  const app = createApp();
  try {
    await app.ready();
    assertDatabaseConfigured(app);

    const limit = Number.parseInt(process.env.NOTIFICATION_PROVIDER_PROCESS_LIMIT ?? "50", 10);
    const summary = await processPendingNotificationProviderDeliveries(app, {
      limit: Number.isFinite(limit) && limit > 0 ? limit : 50
    });

    console.log(JSON.stringify({
      processed: summary.processed,
      sent: summary.sent,
      skipped: summary.skipped,
      failed: summary.failed,
      retryScheduled: summary.retryScheduled,
      providerCallsAllowed: summary.providerCallsAllowed
    }));
  } finally {
    await app.close();
  }
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
