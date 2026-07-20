import { existsSync, readFileSync } from "node:fs";

const problems = [];
const requiredFiles = [
  "apps/api/src/services/notification-provider-execution.service.ts",
  "apps/api/src/scripts/process-notification-deliveries.ts",
  "apps/api/test/notification-provider-execution.service.test.ts",
  "apps/api/test/notification-worker-atomic-claim-contract.test.ts",
  "apps/api/src/services/admin-notification-ops.service.ts",
  "apps/backoffice/src/features/notifications/notification-ops-page.tsx",
  "packages/database/src/schema/index.ts",
  "packages/database/drizzle/0042_notification_worker_atomic_claim.sql",
  "packages/database/drizzle/meta/_journal.json",
  "docs/81-notification-worker-atomic-claim.md",
  ".env.example",
  "package.json"
];

for (const file of requiredFiles) {
  if (!existsSync(`${process.cwd()}/${file}`)) {
    problems.push(`Missing notification worker atomic claim file: ${file}`);
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
  const service = read("apps/api/src/services/notification-provider-execution.service.ts");
  const worker = read("apps/api/src/scripts/process-notification-deliveries.ts");
  const tests = read("apps/api/test/notification-provider-execution.service.test.ts");
  const contractTests = read("apps/api/test/notification-worker-atomic-claim-contract.test.ts");
  const admin = read("apps/api/src/services/admin-notification-ops.service.ts");
  const backoffice = read("apps/backoffice/src/features/notifications/notification-ops-page.tsx");
  const schema = read("packages/database/src/schema/index.ts");
  const migration = read("packages/database/drizzle/0042_notification_worker_atomic_claim.sql");
  const journal = read("packages/database/drizzle/meta/_journal.json");
  const docs = read("docs/81-notification-worker-atomic-claim.md");
  const env = read(".env.example");
  const packageData = JSON.parse(read("package.json"));
  const scripts = packageData.scripts ?? {};
  const betaRunner = read("scripts/run-beta-critical-smoke.mjs");
  const betaBoundary = read("scripts/check-beta-critical-smoke-boundary.mjs");

  for (const token of [
    "claimToken: varchar(\"claim_token\"",
    "claimedAt: timestamp(\"claimed_at\"",
    "claimExpiresAt: timestamp(\"claim_expires_at\"",
    "workerId: varchar(\"worker_id\"",
    "'processing'",
    "notification_delivery_logs_claim_idx"
  ]) {
    mustContain(schema, "packages/database/src/schema/index.ts", token);
  }

  for (const token of [
    '"claim_token" varchar(64)',
    '"claimed_at" timestamp with time zone',
    '"claim_expires_at" timestamp with time zone',
    '"worker_id" varchar(120)',
    "'processing'",
    "notification_delivery_logs_claim_idx"
  ]) {
    mustContain(migration, "packages/database/drizzle/0042_notification_worker_atomic_claim.sql", token);
  }
  mustContain(journal, "packages/database/drizzle/meta/_journal.json", "0042_notification_worker_atomic_claim");

  for (const token of [
    "claimNotificationProviderDelivery",
    "status: \"processing\"",
    "providerStatus: \"processing\"",
    "claimExpiresAt",
    "already_claimed",
    "recoveredStaleClaim",
    "eq(notificationDeliveryLogs.claimToken, claimToken)",
    "options.signal?.aborted",
    "input.signal?.addEventListener"
  ]) {
    mustContain(service, "apps/api/src/services/notification-provider-execution.service.ts", token);
  }

  for (const token of [
    "atomically claims a delivery so concurrent workers call the provider once",
    "recovers an expired processing claim and clears the lease after delivery",
    "does not steal an active processing claim",
    "toHaveBeenCalledTimes(1)",
    "reason: \"already_claimed\""
  ]) {
    mustContain(tests, "apps/api/test/notification-provider-execution.service.test.ts", token);
  }

  for (const token of ["0042_notification_worker_atomic_claim", "notification_delivery_logs_claim_idx", "SIGTERM"]) {
    mustContain(contractTests, "apps/api/test/notification-worker-atomic-claim-contract.test.ts", token);
  }

  for (const token of [
    "SIGTERM",
    "SIGINT",
    "AbortController",
    "workerId",
    "staleRecovered",
    "NOTIFICATION_PROVIDER_CLAIM_TTL_MS"
  ]) {
    mustContain(worker, "apps/api/src/scripts/process-notification-deliveries.ts", token);
  }

  for (const token of ["processing", "claimedAt", "claimExpiresAt", "workerId"]) {
    mustContain(admin, "apps/api/src/services/admin-notification-ops.service.ts", token);
    mustContain(backoffice, "apps/backoffice/src/features/notifications/notification-ops-page.tsx", token);
  }
  mustNotContain(admin, "apps/api/src/services/admin-notification-ops.service.ts", "claimToken:");
  mustNotContain(backoffice, "apps/backoffice/src/features/notifications/notification-ops-page.tsx", "claimToken");

  for (const token of [
    "single active execution",
    "expired processing lease",
    "provider idempotency",
    "SIGTERM",
    "at-least-once"
  ]) {
    mustContain(docs, "docs/81-notification-worker-atomic-claim.md", token);
  }
  mustContain(env, ".env.example", "NOTIFICATION_PROVIDER_CLAIM_TTL_MS=300000");
  mustContain(env, ".env.example", "NOTIFICATION_PROVIDER_WORKER_ID");

  mustContain(scripts["security:notification-worker-atomic-claim"] ?? "", "package.json#security:notification-worker-atomic-claim", "node scripts/check-notification-worker-atomic-claim-boundary.mjs");
  mustContain(scripts["test:api:security"] ?? "", "package.json#test:api:security", "pnpm security:notification-worker-atomic-claim");
  mustContain(scripts["release:mobile:p0"] ?? "", "package.json#release:mobile:p0", "pnpm security:notification-worker-atomic-claim");
  mustContain(betaRunner, "scripts/run-beta-critical-smoke.mjs", "security:notification-worker-atomic-claim");
  mustContain(betaBoundary, "scripts/check-beta-critical-smoke-boundary.mjs", "security:notification-worker-atomic-claim");
}

if (problems.length > 0) {
  console.error("Notification worker atomic claim boundary failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Notification worker atomic claim boundary passed.");
