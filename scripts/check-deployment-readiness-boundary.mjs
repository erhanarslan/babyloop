import { existsSync, readFileSync } from "node:fs";

const problems = [];

const requiredFiles = [
  "scripts/check-deployment-readiness-boundary.mjs",
  "scripts/run-beta-critical-smoke.mjs",
  "scripts/check-beta-critical-smoke-boundary.mjs",
  "docs/59-deployment-readiness-gate.md",
  "docs/25-validation-and-regression-checklist.md",
  "docs/54-production-env-checklist.md",
  "docs/55-beta-critical-smoke-checklist.md",
  "docs/58-beta-critical-smoke-automation.md",
  "docs/83-backup-restore-rollback.md",
  "scripts/check-backup-restore-rollback-boundary.mjs",
  "package.json"
];

for (const file of requiredFiles) {
  if (!existsSync(`${process.cwd()}/${file}`)) {
    problems.push(`Missing required deployment readiness file: ${file}`);
  }
}

function read(relativePath) {
  return readFileSync(`${process.cwd()}/${relativePath}`, "utf8");
}

function mustContain(source, file, token) {
  if (!source.includes(token)) {
    problems.push(`${file} must contain ${JSON.stringify(token)}.`);
  }
}

function mustContainCaseInsensitive(source, file, token) {
  if (!source.toLowerCase().includes(token.toLowerCase())) {
    problems.push(`${file} must contain ${JSON.stringify(token)}.`);
  }
}

function mustNotContain(source, file, token) {
  if (source.includes(token)) {
    problems.push(`${file} must not contain ${JSON.stringify(token)}.`);
  }
}

if (problems.length === 0) {
  checkPackageScripts();
  checkBetaSmokeWiring();
  checkDocs();
  checkNoSecretsOrProviders();
}

function checkPackageScripts() {
  const packageData = JSON.parse(read("package.json"));
  const scripts = packageData.scripts ?? {};
  const deploymentScript = scripts["security:deployment-readiness"] ?? "";
  const apiSecurity = scripts["test:api:security"] ?? "";

  mustContain(deploymentScript, "package.json#security:deployment-readiness", "node scripts/check-deployment-readiness-boundary.mjs");
  mustContain(apiSecurity, "package.json#test:api:security", "pnpm security:deployment-readiness");
}

function checkBetaSmokeWiring() {
  const runner = read("scripts/run-beta-critical-smoke.mjs");
  const boundary = read("scripts/check-beta-critical-smoke-boundary.mjs");

  mustContain(runner, "scripts/run-beta-critical-smoke.mjs", "Deployment readiness guard");
  mustContain(runner, "scripts/run-beta-critical-smoke.mjs", "security:deployment-readiness");
  mustContain(boundary, "scripts/check-beta-critical-smoke-boundary.mjs", "security:deployment-readiness");
}

function checkDocs() {
  const docs = [
    "docs/59-deployment-readiness-gate.md",
    "docs/25-validation-and-regression-checklist.md",
    "docs/54-production-env-checklist.md",
    "docs/55-beta-critical-smoke-checklist.md",
    "docs/58-beta-critical-smoke-automation.md"
  ];

  for (const file of docs) {
    const source = read(file);
    mustContainCaseInsensitive(source, file, "deployment readiness gate");
    mustContain(source, file, "pnpm security:deployment-readiness");
    mustContainCaseInsensitive(source, file, "staging");
    mustContainCaseInsensitive(source, file, "production");
    mustContainCaseInsensitive(source, file, "environment variables");
    mustContainCaseInsensitive(source, file, "secrets");
    mustContainCaseInsensitive(source, file, "database migration");
    mustContainCaseInsensitive(source, file, "rollback");
    mustContainCaseInsensitive(source, file, "observability");
  }

  const backupDoc = read("docs/83-backup-restore-rollback.md");
  for (const token of ["SHA-256", "restore smoke", "no down migration", "manual go/no-go"]) {
    mustContainCaseInsensitive(backupDoc, "docs/83-backup-restore-rollback.md", token);
  }

  const mainDoc = read("docs/59-deployment-readiness-gate.md");
  for (const token of [
    "does not deploy",
    "does not create cloud resources",
    "does not enable AWS, Kubernetes, S3/R2, Redis, n8n, push, email, payment, or production database access",
    "staging/prod deploy remains blocked until explicit implementation",
    "manual approval is required before beta production release"
  ]) {
    mustContain(mainDoc, "docs/59-deployment-readiness-gate.md", token);
  }
}

function checkNoSecretsOrProviders() {
  const files = [
    "scripts/check-deployment-readiness-boundary.mjs",
    "docs/59-deployment-readiness-gate.md",
    "docs/54-production-env-checklist.md",
    "docs/58-beta-critical-smoke-automation.md"
  ];

  for (const file of files) {
    const source = read(file);

    const forbiddenTokens = [
      ["AWS_SECRET", "_ACCESS_KEY="],
      ["AWS_ACCESS", "_KEY_ID="],
      ["DATABASE_URL", "=postgresql://"],
      ["TEST_DATABASE_URL", "=postgresql://"],
      ["REDIS_URL", "=redis://"],
      ["N8N_WEBHOOK", "_URL="],
      ["WEBHOOK", "_SECRET="],
      ["EXPO_ACCESS", "_TOKEN="],
      ["FIREBASE_PRIVATE", "_KEY="],
      ["IYZICO_SECRET", "_KEY="],
      ["STRIPE_SECRET", "_KEY="],
      ["sk", "_live_"],
      ["kubectl", " apply"],
      ["terraform", " apply"],
      ["docker", " push"],
      ["aws", " eks"],
      ["aws", " s3 cp"],
      ["curl https://", "hooks."],
      ["fetch", "("]
    ].map((parts) => parts.join(""));

    for (const forbidden of forbiddenTokens) {
      mustNotContain(source, file, forbidden);
    }
  }
}

if (problems.length > 0) {
  console.error("Deployment readiness boundary guard failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Deployment readiness boundary guard passed.");
