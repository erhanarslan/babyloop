import { existsSync, readFileSync } from "node:fs";

const problems = [];

const requiredFiles = [
  "package.json",
  "apps/mobile/package.json",
  "scripts/check-mobile-auth-security.mjs",
  "scripts/check-mobile-notification-boundary.mjs",
  "docs/24-release-smoke-checklist.md",
  "docs/25-validation-and-regression-checklist.md",
  "docs/55-beta-critical-smoke-checklist.md",
  "docs/56-mobile-scope-freeze.md"
];

const p0TestFiles = [
  "src/ui/mobile-layout.test.ts",
  "src/features/auth/auth-api.test.ts",
  "src/features/security/security-model.test.ts",
  "src/features/sell/sell-form-model.test.ts",
  "src/features/sell/image-upload-model.test.ts",
  "src/features/child/child-reminders-api.test.ts",
  "src/features/child/child-reminders-model.test.ts",
  "src/features/notifications/notifications-api.test.ts",
  "src/features/notifications/notifications-model.test.ts",
  "src/features/auth/auth-sessions-api.test.ts",
  "src/features/security/mobile-session-model.test.ts",
  "src/features/security/mobile-login-approval-model.test.ts",
  "src/features/messages/messages-realtime-model.test.ts"
];

for (const file of requiredFiles) {
  if (!existsSync(`${process.cwd()}/${file}`)) {
    problems.push(`Missing required mobile P0 release gate file: ${file}`);
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

function mustNotContain(source, file, token) {
  if (source.includes(token)) {
    problems.push(`${file} must not contain ${JSON.stringify(token)}.`);
  }
}

function mustContainCaseInsensitive(source, file, token) {
  if (!source.toLowerCase().includes(token.toLowerCase())) {
    problems.push(`${file} must contain ${JSON.stringify(token)}.`);
  }
}

if (problems.length === 0) {
  const rootPackage = JSON.parse(read("package.json"));
  const mobilePackage = JSON.parse(read("apps/mobile/package.json"));

  checkRootScripts(rootPackage);
  checkMobileScripts(mobilePackage);
  checkSecurityGuard();
  checkDocs();
}

function checkRootScripts(rootPackage) {
  const scripts = rootPackage.scripts ?? {};
  const gate = scripts["release:mobile:p0"] ?? "";
  const testP0 = scripts["test:mobile:p0"] ?? "";
  const security = scripts["security:mobile-auth"] ?? "";

  mustContain(gate, "package.json#release:mobile:p0", "pnpm security:mobile-auth");
  mustContain(gate, "package.json#release:mobile:p0", "pnpm security:mobile-notifications");
  mustContain(gate, "package.json#release:mobile:p0", "pnpm test:mobile:p0");
  mustContain(gate, "package.json#release:mobile:p0", "pnpm --filter @babyloop/mobile typecheck");

  mustContain(security, "package.json#security:mobile-auth", "node scripts/check-mobile-auth-security.mjs");

  // The root command deliberately delegates to the mobile package so the P0
  // inventory has one source of truth. Requiring the full Jest command here as
  // well makes this guard reject the package structure it is meant to protect.
  mustContain(testP0, "package.json#test:mobile:p0", "pnpm --filter @babyloop/mobile test:p0");
  mustNotContain(testP0, "package.json#test:mobile:p0", "--runTestsByPath");

  for (const forbidden of [
    "test:e2e:mobile",
    "maestro",
    "RUN_MOBILE_E2E",
    "expo start"
  ]) {
    mustNotContain(gate, "package.json#release:mobile:p0", forbidden);
  }
}

function checkMobileScripts(mobilePackage) {
  const scripts = mobilePackage.scripts ?? {};
  const testP0 = scripts["test:p0"] ?? "";
  const typecheck = scripts.typecheck ?? "";

  mustContain(typecheck, "apps/mobile/package.json#typecheck", "tsc -p tsconfig.json --noEmit");
  mustContain(testP0, "apps/mobile/package.json#test:p0", "jest --runInBand");
  mustContain(testP0, "apps/mobile/package.json#test:p0", "--runTestsByPath");

  for (const testFile of p0TestFiles) {
    mustContain(testP0, "apps/mobile/package.json#test:p0", testFile);
  }

  const e2e = scripts["test:e2e"] ?? "";
  mustContain(e2e, "apps/mobile/package.json#test:e2e", "maestro test .maestro");
}

function checkSecurityGuard() {
  const file = "scripts/check-mobile-auth-security.mjs";
  const source = read(file);

  // Keep this scoped to auth/security boundary checks. The root command delegates
  // to the mobile package, whose test:p0 script owns the complete P0 inventory.
  mustContain(source, file, "SecureStore");
  mustContain(source, file, "MFA-required");
  mustContain(source, file, "mobile login must not require mobile approval for itself");
  mustContain(source, file, "test:mobile:p0");
  mustContain(source, file, "apps/mobile/package.json#test:p0");

}

function checkDocs() {
  const releaseChecklist = read("docs/24-release-smoke-checklist.md");
  const validationChecklist = read("docs/25-validation-and-regression-checklist.md");
  const betaSmoke = read("docs/55-beta-critical-smoke-checklist.md");
  const freeze = read("docs/56-mobile-scope-freeze.md");

  for (const [file, source] of [
    ["docs/24-release-smoke-checklist.md", releaseChecklist],
    ["docs/25-validation-and-regression-checklist.md", validationChecklist],
    ["docs/55-beta-critical-smoke-checklist.md", betaSmoke],
    ["docs/56-mobile-scope-freeze.md", freeze]
  ]) {
    mustContain(source, file, "Mobile P0 release gate");
    mustContain(source, file, "pnpm release:mobile:p0");
    mustContain(source, file, "pnpm security:mobile-auth");
    mustContain(source, file, "pnpm test:mobile:p0");
  }

  for (const token of [
    "Maestro",
    "real-device",
    "manual",
    "not a substitute"
  ]) {
    mustContainCaseInsensitive(releaseChecklist, "docs/24-release-smoke-checklist.md", token);
  }

  for (const token of [
    "mobile login must not require mobile approval for itself",
    "SecureStore",
    "MFA-required"
  ]) {
    mustContainCaseInsensitive(betaSmoke, "docs/55-beta-critical-smoke-checklist.md", token);
  }

  for (const token of [
    "S22",
    "real-device S22 manual QA",
    "expanded Maestro E2E"
  ]) {
    mustContainCaseInsensitive(freeze, "docs/56-mobile-scope-freeze.md", token);
  }

  const forbiddenClaims = [
    "Maestro is required for pnpm release:mobile:p0",
    "pnpm release:mobile:p0 runs Maestro",
    "pnpm release:mobile:p0 verifies real-device QA",
    "mobile P0 is fully production-ready"
  ];

  for (const claim of forbiddenClaims) {
    for (const [file, source] of [
      ["docs/24-release-smoke-checklist.md", releaseChecklist],
      ["docs/25-validation-and-regression-checklist.md", validationChecklist],
      ["docs/55-beta-critical-smoke-checklist.md", betaSmoke],
      ["docs/56-mobile-scope-freeze.md", freeze]
    ]) {
      mustNotContain(source, file, claim);
    }
  }
}

if (problems.length > 0) {
  console.error("Mobile P0 release gate guard failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Mobile P0 release gate guard passed.");
