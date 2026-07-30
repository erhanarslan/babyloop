import { existsSync, readFileSync } from "node:fs";

const problems = [];
const requiredFiles = [
  "apps/api/src/routes/health.routes.ts",
  "apps/api/src/server.ts",
  "apps/api/src/services/runtime-readiness.service.ts",
  "apps/api/src/services/runtime-metrics.service.ts",
  "apps/api/src/services/runtime-observability.service.ts",
  "apps/api/src/services/runtime-worker-heartbeat.service.ts",
  "apps/api/test/runtime-readiness.integration.test.ts",
  "apps/api/test/runtime-observability.service.test.ts",
  "apps/api/test/runtime-worker-heartbeat.service.test.ts",
  "packages/database/drizzle/0043_runtime_readiness_observability.sql",
  "scripts/check-deployment-readiness.mjs",
  "docs/82-runtime-readiness-observability.md",
  ".env.example",
  "package.json"
];

for (const file of requiredFiles) {
  if (!existsSync(`${process.cwd()}/${file}`)) {
    problems.push(`Missing runtime readiness/observability file: ${file}`);
  }
}

function read(file) {
  return readFileSync(`${process.cwd()}/${file}`, "utf8");
}

function mustContain(source, file, token) {
  if (!source.includes(token)) {
    problems.push(`${file} must contain ${JSON.stringify(token)}.`);
  }
}

function mustNotContain(source, file, token) {
  if (source.includes(token)) {
    problems.push(`${file} must not contain ${JSON.stringify(token)}.`);
  }
}

if (problems.length === 0) {
  const health = read("apps/api/src/routes/health.routes.ts");
  for (const token of [
    '"/health/live"',
    '"/health/ready"',
    '"/internal/metrics"',
    "METRICS_AUTH_REQUIRED",
    "constantTimeTextEqual",
    "evaluateRuntimeReadiness",
    "renderPrometheus"
  ]) {
    mustContain(health, "apps/api/src/routes/health.routes.ts", token);
  }

  const readiness = read("apps/api/src/services/runtime-readiness.service.ts");
  for (const token of [
    "select 1 as ok",
    "verifyDatabaseMigrationHead",
    "expectedMigrationHash",
    "probeImageStorageReadiness",
    "QdrantVectorStore",
    "RagRedisClient",
    "WORKER_HEARTBEAT_MISSING",
    "WORKER_HEARTBEAT_STALE",
    "STALE_NOTIFICATION_CLAIMS",
    "HEALTH_FAIL_ON_STALE_NOTIFICATION_CLAIMS"
  ]) {
    mustContain(readiness, "apps/api/src/services/runtime-readiness.service.ts", token);
  }

  const server = read("apps/api/src/server.ts");
  for (const token of [
    "SIGTERM",
    "SIGINT",
    "uncaughtException",
    "unhandledRejection",
    "shutdown",
    "api_startup_failed",
    "observability.captureException"
  ]) {
    mustContain(server, "apps/api/src/server.ts", token);
  }

  const observability = read("apps/api/src/services/runtime-observability.service.ts");
  for (const token of [
    "OBSERVABILITY_ERROR_WEBHOOK_URL",
    "OBSERVABILITY_ERROR_REPORT_TIMEOUT_MS",
    "buildSafeErrorPayload",
    "[redacted-database-url]",
    "Bearer [redacted]",
    "controller.abort()"
  ]) {
    mustContain(observability, "apps/api/src/services/runtime-observability.service.ts", token);
  }
  for (const forbidden of ["console.log(process.env)", "stack:", "request.body", "request.headers"]) {
    mustNotContain(observability, "apps/api/src/services/runtime-observability.service.ts", forbidden);
  }

  const heartbeat = read("apps/api/src/services/runtime-worker-heartbeat.service.ts");
  for (const token of [
    "markRuntimeWorkerStarted",
    "markRuntimeWorkerCompleted",
    "markRuntimeWorkerFailed",
    "sanitizeSummary",
    "lastErrorMessageRedacted"
  ]) {
    mustContain(heartbeat, "apps/api/src/services/runtime-worker-heartbeat.service.ts", token);
  }

  const notificationWorker = read("apps/api/src/scripts/process-notification-deliveries.ts");
  const childWorker = read("apps/api/src/scripts/process-child-reminders.ts");
  for (const token of ["markRuntimeWorkerStarted", "markRuntimeWorkerCompleted", "markRuntimeWorkerFailed", "captureException"]) {
    mustContain(notificationWorker, "apps/api/src/scripts/process-notification-deliveries.ts", token);
    mustContain(childWorker, "apps/api/src/scripts/process-child-reminders.ts", token);
  }

  const migration = read("packages/database/drizzle/0043_runtime_readiness_observability.sql");
  for (const token of [
    '"runtime_worker_heartbeats"',
    '"last_heartbeat_at"',
    '"last_error_message_redacted"',
    "runtime_worker_heartbeats_status_check"
  ]) {
    mustContain(migration, "packages/database/drizzle/0043_runtime_readiness_observability.sql", token);
  }

  const deployment = read("scripts/check-deployment-readiness.mjs");
  for (const token of [
    "checkObservabilityEnv",
    "OBSERVABILITY_METRICS_ENABLED",
    "OBSERVABILITY_METRICS_TOKEN",
    "OBSERVABILITY_ERROR_WEBHOOK_URL",
    "HEALTH_REQUIRE_NOTIFICATION_WORKER",
    "HEALTH_REQUIRE_CHILD_REMINDER_WORKER",
    "HEALTH_FAIL_ON_STALE_NOTIFICATION_CLAIMS"
  ]) {
    mustContain(deployment, "scripts/check-deployment-readiness.mjs", token);
  }

  const envExample = read(".env.example");
  for (const token of [
    "HEALTH_READINESS_TIMEOUT_MS",
    "HEALTH_REQUIRE_NOTIFICATION_WORKER",
    "HEALTH_REQUIRE_CHILD_REMINDER_WORKER",
    "HEALTH_FAIL_ON_STALE_NOTIFICATION_CLAIMS",
    "OBSERVABILITY_METRICS_ENABLED",
    "OBSERVABILITY_METRICS_TOKEN",
    "OBSERVABILITY_ERROR_WEBHOOK_URL"
  ]) {
    mustContain(envExample, ".env.example", token);
  }

  const packageData = JSON.parse(read("package.json"));
  const scripts = packageData.scripts ?? {};
  mustContain(
    scripts["security:runtime-readiness-observability"] ?? "",
    "package.json#security:runtime-readiness-observability",
    "check-runtime-readiness-observability-boundary.mjs"
  );
  mustContain(
    scripts["test:api:security"] ?? "",
    "package.json#test:api:security",
    "pnpm security:runtime-readiness-observability"
  );
}

if (problems.length > 0) {
  console.error("Runtime readiness/observability boundary guard failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Runtime readiness/observability boundary guard passed.");
