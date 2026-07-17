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
const mobileModel = "apps/mobile/src/features/analytics/analytics-event-model.ts";
const backofficeDashboard = "apps/backoffice/src/features/analytics/analytics-dashboard.tsx";
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
mustContain(mobileModel, "MOBILE_ANALYTICS_QUEUE_LIMIT");
mustContain(mobileModel, "takeMobileAnalyticsBatch");
mustContain(backofficeDashboard, "Raw messages");
mustContain(packageJson, "security:product-analytics-privacy");
mustContain(packageJson, "release:analytics");

for (const file of [
  "apps/api/test/analytics.schemas.test.ts",
  "apps/api/test/analytics.routes.test.ts",
  "apps/api/test/product-analytics.service.test.ts",
  "apps/api/test/admin-analytics.routes.test.ts",
  "apps/web/src/features/analytics/analytics-event-model.test.ts",
  "apps/web/src/features/analytics/analytics-session-model.test.ts",
  "apps/mobile/src/features/analytics/analytics-event-model.test.ts",
  "apps/mobile/src/features/analytics/analytics-session-model.test.ts",
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
mustContain("apps/mobile/src/features/analytics/analytics-event-model.test.ts", "private prompt");

for (const file of [ingestService, adminService, webModel, mobileModel, backofficeDashboard]) {
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
