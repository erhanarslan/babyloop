import { existsSync, readFileSync } from "node:fs";

const problems = [];

const requiredFiles = [
  "scripts/check-public-auth-cookie-migration-boundary.mjs",
  "scripts/run-beta-critical-smoke.mjs",
  "scripts/check-beta-critical-smoke-boundary.mjs",
  "docs/60-public-auth-cookie-migration-plan.md",
  "docs/25-validation-and-regression-checklist.md",
  "docs/54-production-env-checklist.md",
  "docs/55-beta-critical-smoke-checklist.md",
  "docs/58-beta-critical-smoke-automation.md",
  "package.json"
];

for (const file of requiredFiles) {
  if (!existsSync(`${process.cwd()}/${file}`)) {
    problems.push(`Missing required public auth cookie migration file: ${file}`);
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
  checkNoRuntimeAuthMutation();
}

function checkPackageScripts() {
  const packageData = JSON.parse(read("package.json"));
  const scripts = packageData.scripts ?? {};
  const publicAuthScript = scripts["security:public-auth-cookie-migration"] ?? "";
  const apiSecurity = scripts["test:api:security"] ?? "";

  mustContain(publicAuthScript, "package.json#security:public-auth-cookie-migration", "node scripts/check-public-auth-cookie-migration-boundary.mjs");
  mustContain(apiSecurity, "package.json#test:api:security", "pnpm security:public-auth-cookie-migration");
}

function checkBetaSmokeWiring() {
  const runner = read("scripts/run-beta-critical-smoke.mjs");
  const boundary = read("scripts/check-beta-critical-smoke-boundary.mjs");

  mustContain(runner, "scripts/run-beta-critical-smoke.mjs", "Public auth cookie migration guard");
  mustContain(runner, "scripts/run-beta-critical-smoke.mjs", "security:public-auth-cookie-migration");
  mustContain(boundary, "scripts/check-beta-critical-smoke-boundary.mjs", "security:public-auth-cookie-migration");
}

function checkDocs() {
  const docs = [
    "docs/60-public-auth-cookie-migration-plan.md",
    "docs/25-validation-and-regression-checklist.md",
    "docs/54-production-env-checklist.md",
    "docs/55-beta-critical-smoke-checklist.md",
    "docs/58-beta-critical-smoke-automation.md"
  ];

  for (const file of docs) {
    const source = read(file);
    mustContainCaseInsensitive(source, file, "public auth cookie migration");
    mustContain(source, file, "pnpm security:public-auth-cookie-migration");
    mustContainCaseInsensitive(source, file, "httpOnly");
    mustContainCaseInsensitive(source, file, "sameSite");
    mustContainCaseInsensitive(source, file, "secure cookie");
    mustContainCaseInsensitive(source, file, "CSRF");
    mustContainCaseInsensitive(source, file, "refresh token");
    mustContainCaseInsensitive(source, file, "logout");
    mustContainCaseInsensitive(source, file, "session refresh");
    mustContainCaseInsensitive(source, file, "rollback");
  }

  const mainDoc = read("docs/60-public-auth-cookie-migration-plan.md");
  for (const token of [
    "does not change runtime auth behavior",
    "does not introduce document-cookie token handling",
    "does not store access tokens in localStorage or sessionStorage",
    "public web migration remains blocked until explicit implementation",
    "manual QA must cover register, login, refresh, logout, MFA/OTP, favorites, messaging, and protected routes"
  ]) {
    mustContain(mainDoc, "docs/60-public-auth-cookie-migration-plan.md", token);
  }
}

function checkNoRuntimeAuthMutation() {
  const files = [
    "scripts/check-public-auth-cookie-migration-boundary.mjs",
    "docs/60-public-auth-cookie-migration-plan.md",
    "docs/54-production-env-checklist.md",
    "docs/58-beta-critical-smoke-automation.md"
  ];

  const forbiddenTokens = [
    ["document", "\u002ecookie"],
    ["localStorage", "\u002esetItem"],
    ["sessionStorage", "\u002esetItem"],
    ["Authorization", ": Bearer"],
    ["accessToken", "=", "ey"],
    ["refreshToken", "=", "ey"],
    ["Set-Cookie", ": babyloop_access"],
    ["Set-Cookie", ": babyloop_refresh"],
    ["NEXT_PUBLIC", "_ACCESS_TOKEN"],
    ["VITE", "_ACCESS_TOKEN"],
    ["console.log", "(process.env)"]
  ].map((parts) => parts.join(""));

  for (const file of files) {
    const source = read(file);
    for (const forbidden of forbiddenTokens) {
      mustNotContain(source, file, forbidden);
    }
  }
}

if (problems.length > 0) {
  console.error("Public auth cookie migration boundary guard failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Public auth cookie migration boundary guard passed.");
