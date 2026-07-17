import { createApp } from "../app.js";
import { rollupAnalyticsDay } from "../services/product-analytics.service.js";

async function main(): Promise<void> {
  const app = createApp();
  const date = process.env.ANALYTICS_ROLLUP_DATE ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const platform = readPlatform(process.env.ANALYTICS_ROLLUP_PLATFORM);

  try {
    await app.ready();
    assertDatabaseConfigured(app);

    const summary = await rollupAnalyticsDay(app, date, platform);

    console.log(JSON.stringify({
      date: summary.date,
      rowsWritten: summary.rowsWritten,
      platform
    }, null, 2));
  } finally {
    await app.close();
  }
}

function readPlatform(value: string | undefined): "web" | "mobile" | "all" {
  return value === "web" || value === "mobile" ? value : "all";
}

function assertDatabaseConfigured(app: ReturnType<typeof createApp>): void {
  if (!("db" in app) || !app.db) {
    throw new Error("DATABASE_URL is required to run analytics rollup.");
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Analytics rollup failed.");
  process.exitCode = 1;
});
