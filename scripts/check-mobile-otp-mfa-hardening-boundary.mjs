import { existsSync, readFileSync } from "node:fs";

const problems = [];

const requiredFiles = [
  "apps/mobile/src/features/auth/mobile-otp-mfa-hardening.ts",
  "scripts/check-mobile-otp-mfa-hardening-boundary.mjs",
  "scripts/run-beta-critical-smoke.mjs",
  "scripts/check-beta-critical-smoke-boundary.mjs",
  "docs/64-mobile-otp-mfa-hardening-gate.md",
  "docs/25-validation-and-regression-checklist.md",
  "docs/54-production-env-checklist.md",
  "docs/55-beta-critical-smoke-checklist.md",
  "docs/56-mobile-real-device-s22-qa-checklist.md",
  "docs/58-beta-critical-smoke-automation.md",
  "package.json"
];

for (const file of requiredFiles) {
  if (!existsSync(`${process.cwd()}/${file}`)) {
    problems.push(`Missing required mobile OTP/MFA hardening file: ${file}`);
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
  checkMobilePolicy();
  checkPackageScripts();
  checkBetaSmokeWiring();
  checkDocs();
  checkNoRuntimeAuthMutationOrSecrets();
}

function checkMobilePolicy() {
  const file = "apps/mobile/src/features/auth/mobile-otp-mfa-hardening.ts";
  const source = read(file);

  for (const token of [
    "evaluateMobileOtpMfaHardening",
    "getMobileOtpMfaHardeningPreview",
    "assertMobileOtpMfaHardeningReadinessOnly",
    "runtimeAuthChanged: false",
    "otpProviderEnabled: false",
    "smsEnabled: false",
    "authenticatorEnabled: false",
    "emailOtpRequired: true",
    "secureStorageRequired: true",
    "rateLimitRequired: true",
    "noSecretLoggingRequired: true",
    "sessionRefreshRequiredAfterVerify: true",
    "logoutCleanupRequired: true",
    "realDeviceQaRequired: true",
    "valid OTP verification",
    "invalid OTP error",
    "expired OTP error",
    "rate-limited OTP error",
    "real Galaxy S22 QA"
  ]) {
    mustContain(source, file, token);
  }

  for (const forbidden of [
    "runtimeAuthChanged: true",
    "otpProviderEnabled: true",
    "smsEnabled: true",
    "authenticatorEnabled: true",
    "console.log",
    "AsyncStorage" + ".setItem",
    "localStorage" + ".setItem",
    "sessionStorage" + ".setItem"
  ]) {
    mustNotContain(source, file, forbidden);
  }
}

function checkPackageScripts() {
  const packageData = JSON.parse(read("package.json"));
  const scripts = packageData.scripts ?? {};
  const hardeningScript = scripts["security:mobile-otp-mfa-hardening"] ?? "";
  const apiSecurity = scripts["test:api:security"] ?? "";

  mustContain(
    hardeningScript,
    "package.json#security:mobile-otp-mfa-hardening",
    "node scripts/check-mobile-otp-mfa-hardening-boundary.mjs"
  );
  mustContain(apiSecurity, "package.json#test:api:security", "pnpm security:mobile-otp-mfa-hardening");
}

function checkBetaSmokeWiring() {
  const runner = read("scripts/run-beta-critical-smoke.mjs");
  const boundary = read("scripts/check-beta-critical-smoke-boundary.mjs");

  mustContain(runner, "scripts/run-beta-critical-smoke.mjs", "Mobile OTP/MFA hardening guard");
  mustContain(runner, "scripts/run-beta-critical-smoke.mjs", "security:mobile-otp-mfa-hardening");
  mustContain(boundary, "scripts/check-beta-critical-smoke-boundary.mjs", "security:mobile-otp-mfa-hardening");
}

function checkDocs() {
  const docs = [
    "docs/64-mobile-otp-mfa-hardening-gate.md",
    "docs/25-validation-and-regression-checklist.md",
    "docs/54-production-env-checklist.md",
    "docs/55-beta-critical-smoke-checklist.md",
    "docs/56-mobile-real-device-s22-qa-checklist.md",
    "docs/58-beta-critical-smoke-automation.md"
  ];

  for (const file of docs) {
    const source = read(file);
    mustContainCaseInsensitive(source, file, "mobile OTP/MFA hardening");
    mustContain(source, file, "pnpm security:mobile-otp-mfa-hardening");
    mustContainCaseInsensitive(source, file, "SecureStore");
    mustContainCaseInsensitive(source, file, "OTP");
    mustContainCaseInsensitive(source, file, "MFA");
    mustContainCaseInsensitive(source, file, "rate limit");
    mustContainCaseInsensitive(source, file, "session refresh");
    mustContainCaseInsensitive(source, file, "logout cleanup");
    mustContainCaseInsensitive(source, file, "Galaxy S22");
  }

  const mainDoc = read("docs/64-mobile-otp-mfa-hardening-gate.md");
  for (const token of [
    "does not change runtime auth behavior",
    "does not enable SMS OTP",
    "does not enable authenticator MFA",
    "does not enable push security notification",
    "OTP/token/cookie/password values must not be logged",
    "manual Galaxy S22 QA evidence is required before beta release"
  ]) {
    mustContain(mainDoc, "docs/64-mobile-otp-mfa-hardening-gate.md", token);
  }
}

function checkNoRuntimeAuthMutationOrSecrets() {
  const files = [
    "apps/mobile/src/features/auth/mobile-otp-mfa-hardening.ts",
    "scripts/check-mobile-otp-mfa-hardening-boundary.mjs",
    "docs/64-mobile-otp-mfa-hardening-gate.md",
    "docs/58-beta-critical-smoke-automation.md"
  ];

  const forbiddenTokens = [
    ["otp", "-secret"],
    ["access-token", "-secret"],
    ["refresh-token", "-secret"],
    ["password", "-secret"],
    ["document", ".cookie"],
    ["AsyncStorage", ".setItem"],
    ["localStorage", ".setItem"],
    ["sessionStorage", ".setItem"],
    ["Authorization", ": Bearer"],
    ["SMS_PROVIDER", "_KEY="],
    ["EXPO_ACCESS", "_TOKEN="],
    ["FIREBASE_PRIVATE", "_KEY="],
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
  console.error("Mobile OTP/MFA hardening boundary guard failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Mobile OTP/MFA hardening boundary guard passed.");
