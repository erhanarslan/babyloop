import { createApp } from "../app.js";
import { processPendingNotificationProviderDeliveries } from "../services/notification-provider-execution.service.js";

async function main(): Promise<void> {
  const app = createApp();
  await app.ready();

  try {
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

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Notification provider processing failed.");
  process.exit(1);
});
