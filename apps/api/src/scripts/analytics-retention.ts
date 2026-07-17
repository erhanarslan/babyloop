import { createApp } from "../app.js";
import { applyAnalyticsRetention } from "../services/product-analytics.service.js";

async function main(): Promise<void> {
  const app = createApp();
  const dryRun = process.env.ANALYTICS_RETENTION_DRY_RUN !== "false";
  const rawRetentionDays = readPositiveInteger("ANALYTICS_RAW_RETENTION_DAYS", 90);
  const sessionRetentionDays = readPositiveInteger("ANALYTICS_SESSION_RETENTION_DAYS", 180);

  if (!dryRun && process.env.ANALYTICS_RETENTION_CONFIRM !== "DELETE_EXPIRED_ANALYTICS") {
    throw new Error("Set ANALYTICS_RETENTION_CONFIRM=DELETE_EXPIRED_ANALYTICS to delete expired analytics rows.");
  }

  try {
    await app.ready();
    assertDatabaseConfigured(app);

    const summary = await applyAnalyticsRetention(app, {
      dryRun,
      rawRetentionDays,
      sessionRetentionDays
    });

    console.log(JSON.stringify(summary, null, 2));
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

function assertDatabaseConfigured(app: ReturnType<typeof createApp>): void {
  if (!("db" in app) || !app.db) {
    throw new Error("DATABASE_URL is required to run analytics retention.");
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Analytics retention failed.");
  process.exitCode = 1;
});
