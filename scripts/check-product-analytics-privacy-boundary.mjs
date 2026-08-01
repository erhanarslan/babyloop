import { existsSync, readFileSync } from "node:fs";

const problems = [];

function read(file) {
  if (!existsSync(file)) {
    problems.push(`Missing required file: ${file}`);
    return "";
  }

  return readFileSync(file, "utf8");
}

function mustContain(file, token) {
  const source = read(file);

  if (!source.includes(token)) {
    problems.push(`${file} must contain ${JSON.stringify(token)}`);
  }
}

function mustNotContain(file, token) {
  const source = read(file);

  if (source.includes(token)) {
    problems.push(`${file} must not contain ${JSON.stringify(token)}`);
  }
}

const taxonomy = "packages/shared/src/analytics-events.ts";
const schema = "packages/database/src/schema/index.ts";
const ingestSchema = "apps/api/src/schemas/analytics.schemas.ts";
const ingestService = "apps/api/src/services/product-analytics.service.ts";
const adminService = "apps/api/src/services/admin-analytics.service.ts";
const webModel = "apps/web/src/features/analytics/analytics-event-model.ts";
const webProvider = "apps/web/src/features/analytics/analytics-provider.tsx";
const webRootProvider = "apps/web/src/app/providers.tsx";
const mobileModel = "apps/mobile/src/features/analytics/analytics-event-model.ts";
const mobileProvider = "apps/mobile/src/features/analytics/analytics-provider.tsx";
const mobileRootLayout = "apps/mobile/app/_layout.tsx";
const mobileJestConfig = "apps/mobile/jest.config.js";
const backofficeDashboard = "apps/backoffice/src/features/analytics/analytics-dashboard.tsx";
const backofficeSectionPage = "apps/backoffice/src/features/analytics/analytics-section-page.tsx";
const demoSeed = "apps/api/src/scripts/demo-analytics-seed.ts";
const dbSmoke = "apps/api/src/scripts/analytics-db-smoke.ts";
const packageJson = "package.json";

mustContain(taxonomy, "analyticsEventPropertyAllowlist");
mustContain(taxonomy, "messageBody");
mustContain(taxonomy, "assistantPrompt");
mustContain(taxonomy, "childNoteBody");
mustContain(schema, "analyticsEvents");
mustContain(schema, "analyticsSessions");
mustContain(schema, "analyticsDailyOverview");
mustContain(schema, "analyticsDailyPages");
mustContain(schema, "analyticsDailyCategories");
mustContain(schema, "analyticsDailyAuth");
mustContain(ingestSchema, "getAllowedAnalyticsProperties");
mustContain(ingestSchema, "analyticsSensitivePropertyKeys");
mustContain(ingestService, "hashAnonymousId");
mustContain(ingestService, "sanitizePagePath");
mustContain(ingestService, "applyAnalyticsRetention");
mustContain(ingestService, "rollupAnalyticsDay");
mustContain(adminService, "users.emailVerifiedAt");
mustContain(adminService, "authAccounts.provider");
mustContain(adminService, "analyticsDailyOverview");
mustContain(webModel, "stripUrlDetails");
mustContain(webModel, "clampEngagementDelta");
mustContain(webProvider, "AnalyticsProvider");
mustContain(webProvider, "visibilitychange");
mustContain(webProvider, "trackEngagement");
mustContain(webProvider, "AUTH_SESSION_ENDED_EVENT");
mustContain(webRootProvider, "AnalyticsProvider");
mustContain(mobileModel, "MOBILE_ANALYTICS_QUEUE_LIMIT");
mustContain(mobileModel, "takeMobileAnalyticsBatch");
mustContain(mobileProvider, "MobileAnalyticsProvider");
mustContain(mobileProvider, "AppState");
mustContain(mobileProvider, "trackEngagement");
mustContain(mobileRootLayout, "MobileAnalyticsProvider");
mustContain(mobileJestConfig, "<rootDir>/../../packages/shared/src/index.ts");
mustNotContain(mobileJestConfig, '"^@babyloop/shared$": "<rootDir>/../../packages/shared/src/analytics-events.ts"');
mustContain(backofficeDashboard, "Mesaj gövdesi");
mustContain(backofficeSectionPage, "Veri Kalitesi");
mustContain("apps/backoffice/src/app/analytics/users/page.tsx", "AnalyticsSectionPage");
mustContain("apps/backoffice/src/app/analytics/auth/page.tsx", "AnalyticsSectionPage");
mustContain("apps/backoffice/src/app/analytics/engagement/page.tsx", "AnalyticsSectionPage");
mustContain("apps/backoffice/src/app/analytics/marketplace/page.tsx", "AnalyticsSectionPage");
mustContain("apps/backoffice/src/app/analytics/messaging/page.tsx", "AnalyticsSectionPage");
mustContain("apps/backoffice/src/app/analytics/assistant/page.tsx", "AnalyticsSectionPage");
mustContain("apps/backoffice/src/app/analytics/child/page.tsx", "AnalyticsSectionPage");
mustContain("apps/backoffice/src/app/analytics/funnels/page.tsx", "AnalyticsSectionPage");
mustContain("apps/backoffice/src/app/analytics/data-quality/page.tsx", "AnalyticsSectionPage");
mustContain(demoSeed, "BABYLOOP_DEMO_SEED_ENABLED");
mustContain(demoSeed, "rollupAnalyticsDay");
mustContain(demoSeed, "trackServerAnalyticsEvent");
mustContain(demoSeed, "onConflictDoNothing");
mustContain(dbSmoke, "getAdminAnalyticsOverview");
mustContain(dbSmoke, "applyAnalyticsRetention");
mustContain(packageJson, "security:product-analytics-privacy");
mustContain(packageJson, "release:analytics");
mustContain(packageJson, "release:analytics:runtime");
mustContain(packageJson, "demo:seed:analytics");
mustContain(packageJson, "smoke:analytics:db");

for (const file of [
  "apps/api/test/analytics.schemas.test.ts",
  "apps/api/test/analytics.routes.test.ts",
  "apps/api/test/product-analytics.service.test.ts",
  "apps/api/test/admin-analytics.routes.test.ts",
  "apps/web/src/features/analytics/analytics-event-model.test.ts",
  "apps/web/src/features/analytics/analytics-session-model.test.ts",
  "apps/web/src/features/analytics/analytics-client.test.ts",
  "apps/mobile/src/features/analytics/analytics-event-model.test.ts",
  "apps/mobile/src/features/analytics/analytics-session-model.test.ts",
  "apps/mobile/src/features/analytics/analytics-client.test.ts",
  "apps/backoffice/src/features/analytics/analytics-dashboard-model.test.ts",
  "apps/backoffice/src/features/analytics/analytics-api.test.ts"
]) {
  if (!existsSync(file)) {
    problems.push(`Missing analytics test: ${file}`);
  }
}

mustContain("apps/api/test/analytics.routes.test.ts", "999999999999");
mustContain("apps/api/test/analytics.schemas.test.ts", "messageBody");
mustContain("apps/web/src/features/analytics/analytics-event-model.test.ts", "token=secret");
mustContain("apps/web/src/features/analytics/analytics-client.test.ts", "does not drop queued events");
mustContain("apps/mobile/src/features/analytics/analytics-event-model.test.ts", "private prompt");
mustContain("apps/mobile/src/features/analytics/analytics-client.test.ts", "keeps queued events");

for (const file of [ingestService, adminService, webModel, webProvider, mobileModel, mobileProvider, backofficeDashboard, backofficeSectionPage, demoSeed]) {
  mustNotContain(file, "document.cookie");
  mustNotContain(file, "localStorage.accessToken");
  mustNotContain(file, "sessionStorage.accessToken");
  mustNotContain(file, "message.body");
  mustNotContain(file, "assistantPrompt:");
  mustNotContain(file, "imageBase64:");
}

if (problems.length > 0) {
  console.error("Product analytics privacy boundary failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Product analytics privacy boundary passed.");
