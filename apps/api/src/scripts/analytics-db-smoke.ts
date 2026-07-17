import {
  analyticsDailyOverview,
  analyticsEvents,
  analyticsSessions
} from "@babyloop/database/schema";
import { sql } from "drizzle-orm";
import { createApp } from "../app.js";
import {
  getAdminAnalyticsOverview,
  listAdminAnalyticsPages
} from "../services/admin-analytics.service.js";
import { applyAnalyticsRetention } from "../services/product-analytics.service.js";

async function main(): Promise<void> {
  const app = createApp();

  try {
    await app.ready();
    assertDatabaseConfigured(app);

    const [rawEvents, sessions, rollups, overview, pages, retention] = await Promise.all([
      countRows(app, analyticsEvents),
      countRows(app, analyticsSessions),
      countRows(app, analyticsDailyOverview),
      getAdminAnalyticsOverview(app, {}),
      listAdminAnalyticsPages(app, {}),
      applyAnalyticsRetention(app, { dryRun: true })
    ]);

    if (rawEvents === 0) {
      throw new Error("Analytics smoke failed: analytics_events is empty. Run BABYLOOP_DEMO_SEED_ENABLED=true pnpm demo:seed:analytics first.");
    }

    if (rollups === 0) {
      throw new Error("Analytics smoke failed: analytics_daily_overview is empty. Run pnpm analytics:rollup or demo analytics seed.");
    }

    console.log(JSON.stringify({
      averageSessionEngagementMs: overview.averageSessionEngagementMs,
      listingViews: overview.listingViews,
      pageRows: pages.length,
      rawEvents,
      retentionDryRun: retention.dryRun,
      rollups,
      sessions,
      totalRegisteredUsers: overview.totalRegisteredUsers,
      verifiedUsers: overview.verifiedUsers
    }, null, 2));
  } finally {
    await app.close();
  }
}

async function countRows(
  app: ReturnType<typeof createApp>,
  table: typeof analyticsEvents | typeof analyticsSessions | typeof analyticsDailyOverview
): Promise<number> {
  const [row] = await app.db.select({ itemCount: sql<number>`count(*)::int` }).from(table);
  return row?.itemCount ?? 0;
}

function assertDatabaseConfigured(app: ReturnType<typeof createApp>): void {
  if (!("db" in app) || !app.db) {
    throw new Error("DATABASE_URL is required to run analytics DB smoke.");
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Analytics DB smoke failed.");
  process.exitCode = 1;
});
