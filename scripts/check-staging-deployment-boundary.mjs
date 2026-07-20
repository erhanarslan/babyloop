import { existsSync, readFileSync } from "node:fs";

const problems = [];
const requiredFiles = [
  ".dockerignore",
  ".github/workflows/container-images.yml",
  "deploy/docker/Dockerfile",
  "deploy/docker-bake.hcl",
  "deploy/compose/docker-compose.runtime.yml",
  "deploy/env/staging.env.example",
  "deploy/env/production.env.example",
  "deploy/proxy/Caddyfile.example",
  "scripts/deploy/deployment-lib.mjs",
  "scripts/deploy/worker-loop.mjs",
  "scripts/deploy/post-deploy-smoke.mjs",
  "scripts/deploy/promote-release.mjs",
  "scripts/deploy/adapters/docker-compose.mjs",
  "apps/api/src/scripts/migrate-database.ts",
  "docs/85-staging-production-deployment.md"
];

for (const file of requiredFiles) {
  if (!existsSync(file)) problems.push(`Missing deployment file: ${file}`);
}

function read(file) { return readFileSync(file, "utf8"); }
function must(file, token) {
  if (!read(file).includes(token)) problems.push(`${file} must contain ${JSON.stringify(token)}.`);
}
function mustNot(file, token) {
  if (read(file).includes(token)) problems.push(`${file} must not contain ${JSON.stringify(token)}.`);
}
function mustAppearInOrder(file, tokens) {
  const source = read(file);
  let cursor = -1;
  for (const token of tokens) {
    const index = source.indexOf(token, cursor + 1);
    if (index < 0) {
      problems.push(`${file} must contain ${JSON.stringify(token)} in the required promotion order.`);
      return;
    }
    cursor = index;
  }
}

if (problems.length === 0) {
  for (const target of ["AS api", "AS web", "AS backoffice", "USER node", "HEALTHCHECK", "--frozen-lockfile"]) {
    must("deploy/docker/Dockerfile", target);
  }
  must("deploy/docker/Dockerfile", "pnpm --filter @babyloop/api deploy --prod --legacy");
  must("deploy/docker/Dockerfile", "packages/database/drizzle");

  const composeTokens = [
    "API_IMAGE must be a digest-pinned image",
    "read_only: true",
    "no-new-privileges:true",
    "cap_drop:",
    "dist/scripts/migrate-database.js",
    "worker-loop.mjs",
    "/health/ready",
    "stop_grace_period"
  ];
  for (const token of composeTokens) must("deploy/compose/docker-compose.runtime.yml", token);
  mustNot("deploy/compose/docker-compose.runtime.yml", ":latest");

  for (const file of ["deploy/env/staging.env.example", "deploy/env/production.env.example"]) {
    for (const token of [
      "IMAGE_STORAGE_DRIVER=s3",
      "RAG_REDIS_ENABLED=true",
      "OBSERVABILITY_METRICS_ENABLED=true",
      "HEALTH_REQUIRE_NOTIFICATION_WORKER=true",
      "HEALTH_REQUIRE_CHILD_REMINDER_WORKER=true",
      "BACKUP_ENCRYPTION_MODE=age",
      "MIGRATION_ENVIRONMENT="
    ]) must(file, token);
  }

  for (const token of [
    "postgres-backup.mjs",
    "check-deployment-readiness.mjs",
    "release-manifest.mjs",
    '"--profile", "release"',
    "post-deploy-smoke.mjs",
    "DEPLOY_GO_NO_GO"
  ]) must("scripts/deploy/promote-release.mjs", token);

  for (const token of ["SIGTERM", "shell: false", "worker_loop_cycle_completed"]) {
    must("scripts/deploy/worker-loop.mjs", token);
  }

  for (const token of [
    "pg_advisory_lock",
    "MIGRATION_CONFIRM",
    "DATABASE_MIGRATIONS_DIR",
    "fileURLToPath(import.meta.url)",
    "../../packages/database/drizzle",
    "../../../../packages/database/drizzle"
  ]) {
    must("apps/api/src/scripts/migrate-database.ts", token);
  }

  must("apps/api/src/server.ts", 'process.once("SIGTERM"');
  must("apps/api/src/server.ts", "API graceful shutdown requested");
  must("apps/web/next.config.mjs", 'output: "standalone"');
  must("apps/backoffice/next.config.mjs", 'output: "standalone"');
  must("apps/backoffice/next.config.mjs", "NEXT_PUBLIC_API_BASE_URL");
  must(".github/workflows/container-images.yml", "docker/build-push-action@v6");
  must(".github/workflows/container-images.yml", "steps.build.outputs.digest");
  mustAppearInOrder("scripts/deploy/promote-release.mjs", [
    'runCommand("docker", ["compose"',
    '"scripts/ops/postgres-backup.mjs"',
    '"scripts/check-deployment-readiness.mjs"',
    '"scripts/ops/release-manifest.mjs"',
    '"--profile", "release"',
    '"up", "-d"',
    '"scripts/deploy/post-deploy-smoke.mjs"',
    "const receipt = await writeJsonReceipt"
  ]);
  mustNot("apps/api/src/server.ts", "migrate(");
  for (const file of [
    "scripts/deploy/deployment-lib.mjs",
    "scripts/deploy/promote-release.mjs",
    "scripts/deploy/adapters/docker-compose.mjs",
    "scripts/deploy/worker-loop.mjs"
  ]) {
    mustNot(file, "shell: true");
  }

  const packageData = JSON.parse(read("package.json"));
  const scripts = packageData.scripts ?? {};
  for (const name of [
    "security:staging-deployment",
    "test:deploy",
    "deploy:promote",
    "deploy:smoke",
    "deploy:images:plan"
  ]) {
    if (!scripts[name]) problems.push(`package.json is missing ${name}.`);
  }
  if (!(scripts["test:api:security"] ?? "").includes("security:staging-deployment")) {
    problems.push("test:api:security must include security:staging-deployment.");
  }
}

if (problems.length > 0) {
  console.error("Staging/production deployment boundary failed:");
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log("Staging/production deployment boundary passed.");
