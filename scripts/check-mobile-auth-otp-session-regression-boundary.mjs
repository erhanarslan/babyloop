#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const problems = [];
const textExt = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".md", ".json"]);

function walk(dir) {
  const abs = join(root, dir);
  if (!existsSync(abs)) return [];

  const out = [];

  for (const entry of readdirSync(abs)) {
    if (["node_modules", ".next", "dist", "coverage", ".turbo"].includes(entry)) continue;

    const full = join(abs, entry);
    const st = statSync(full);

    if (st.isDirectory()) {
      out.push(...walk(relative(root, full)));
      continue;
    }

    const dot = entry.lastIndexOf(".");
    const ext = dot >= 0 ? entry.slice(dot) : "";

    if (textExt.has(ext)) out.push(relative(root, full));
  }

  return out;
}

function read(file) {
  return readFileSync(join(root, file), "utf8");
}

function lower(value) {
  return value.toLowerCase();
}

function corpus(files) {
  return files
    .filter((file) => existsSync(join(root, file)))
    .map((file) => `\n// FILE ${file}\n${read(file)}`)
    .join("\n");
}

function filesMatching(files, tokens) {
  return files.filter((file) => tokens.some((token) => lower(file).includes(lower(token))));
}

function must(label, source, token) {
  if (!lower(source).includes(lower(token))) {
    problems.push(`${label} must contain ${JSON.stringify(token)}.`);
  }
}

function any(label, source, tokens) {
  if (!tokens.some((token) => lower(source).includes(lower(token)))) {
    problems.push(`${label} must contain one of ${JSON.stringify(tokens)}.`);
  }
}

function not(label, source, pattern, description) {
  if (pattern.test(source)) {
    problems.push(`${label} must not contain ${description}.`);
  }
}

const apiSrc = walk("apps/api/src");
const apiTests = walk("apps/api/test");
const mobileSrc = walk("apps/mobile/src");
const mobileTests = mobileSrc.filter((file) => file.includes(".test."));
const docs = walk("docs");

const apiAuthFiles = filesMatching(apiSrc, ["auth", "mfa", "otp", "session", "cookie", "security"]);
const apiAuthTests = filesMatching(apiTests, ["auth", "mfa", "otp", "refresh", "cookie", "session"]);
const mobileAuthFiles = filesMatching(mobileSrc, ["auth", "login", "logout", "mfa", "otp", "session", "secure"]);
const mobileAuthTests = filesMatching(mobileTests, ["auth", "login", "logout", "mfa", "otp", "session", "secure"]);
const docsBoundaryFiles = [
  "docs/25-validation-and-regression-checklist.md",
  "docs/55-beta-critical-smoke-checklist.md",
  "docs/56-mobile-scope-freeze.md",
  "docs/58-beta-critical-smoke-automation.md",
  "docs/72-auth-session-realtime-readstate-boundary.md",
  "docs/74-mobile-otp-mfa-session-regression-boundary.md"
].filter((file) => existsSync(join(root, file)));

if (apiAuthFiles.length === 0) problems.push("API auth/MFA/OTP/session corpus is empty.");
if (apiAuthTests.length === 0) problems.push("API auth/MFA/OTP/session test corpus is empty.");
if (mobileAuthFiles.length === 0) problems.push("Mobile auth/MFA/OTP/session corpus is empty.");
if (mobileAuthTests.length === 0) problems.push("Mobile auth/MFA/OTP/session test corpus is empty.");
if (!existsSync(join(root, "docs/74-mobile-otp-mfa-session-regression-boundary.md"))) problems.push("docs/74-mobile-otp-mfa-session-regression-boundary.md is required.");

if (problems.length === 0) {
  checkApiOtpMfaSessionBoundary();
  checkMobileOtpMfaSessionBoundary();
  checkSecureStorageAndNoLeakBoundary();
  checkReleaseGateAndDocs();
}

function checkApiOtpMfaSessionBoundary() {
  const api = corpus(apiAuthFiles);
  const tests = corpus(apiAuthTests);

  for (const token of ["login", "logout", "refresh"]) {
    must("API auth session corpus", api + tests, token);
  }

  any("API auth/me boundary", api + tests, ["/auth/me", "auth/me", "current user", "getCurrentUser", "me"]);
  any("API MFA required response boundary", api + tests, ["mfa_required", "mfaRequired", "MFA_REQUIRED", "requiresMfa", "requires mfa"]);
  any("API OTP challenge boundary", api + tests, ["otp", "one-time", "one time", "challenge", "verification code"]);
  any("API MFA verification boundary", api + tests, ["verify", "verification", "confirm", "mfa"]);
  any("API refresh cookie/session boundary", api + tests, ["refreshToken", "refresh token", "refresh cookie", "session"]);
  any("API logout revoke boundary", api + tests, ["revoke", "revoked", "logout", "clearCookie", "clear cookie"]);
  any("API session negative tests", tests, ["401", "unauthenticated", "invalid", "expired", "forbidden"]);
  any("API MFA negative tests", tests, ["mfa_required", "invalid otp", "invalid code", "expired", "rate limit", "too many"]);
  any("API no-token DTO assertions", tests, ["not.toHaveProperty", "not.toContain", "httpOnly", "does not expose", "accessToken", "refreshToken"]);
}

function checkMobileOtpMfaSessionBoundary() {
  const mobile = corpus(mobileAuthFiles);
  const tests = corpus(mobileAuthTests);
  const docs = corpus(docsBoundaryFiles);
  const combined = mobile + tests + docs;

  any("mobile login API boundary", combined, ["login", "/auth/login", "signIn", "submitLogin"]);
  any("mobile MFA required screen-state boundary", combined, ["mfa_required", "mfaRequired", "MFA", "OTP", "otp"]);
  any("mobile OTP submit/verify boundary", combined, ["verify", "verification", "confirm", "otp", "code"]);
  any("mobile refresh/session boundary", combined, ["refresh", "/auth/refresh", "session", "restore"]);
  any("mobile logout cleanup boundary", combined, ["logout", "/auth/logout", "clear", "deleteItemAsync", "signOut"]);
  any("mobile auth error-state boundary", combined, ["invalid", "expired", "loading", "error", "blocked", "retry"]);
  any("mobile auth tests cover state transitions", tests + docs, ["test", "mfa", "otp", "refresh", "logout", "session"]);
}

function checkSecureStorageAndNoLeakBoundary() {
  const mobile = corpus(mobileAuthFiles);
  const tests = corpus([...mobileAuthTests, ...apiAuthTests]);
  const docs = corpus(docsBoundaryFiles);

  any("mobile SecureStore boundary", mobile + tests + docs, ["SecureStore", "secure-store", "expo-secure-store", "deleteItemAsync", "setItemAsync", "getItemAsync"]);
  any("auth no-leak tests/docs", tests + docs, ["does not expose accessToken", "does not expose refreshToken", "does not expose passwordHash", "httpOnly", "not.toHaveProperty", "not.toContain"]);

  for (const file of mobileAuthFiles) {
    const source = read(file);
    not(file, source, /AsyncStorage\.[a-zA-Z]+\s*\([^)]*token/iu, "AsyncStorage token persistence");
    not(file, source, /localStorage/iu, "localStorage in mobile auth surface");
    not(file, source, /sessionStorage/iu, "sessionStorage in mobile auth surface");
    not(file, source, /document\.cookie/u, "document.cookie in mobile auth surface");
    not(file, source, /console\.(log|debug|info)\s*\([^)]*(accessToken|refreshToken|authorization|passwordHash|otp|mfa|cookie)/iu, "sensitive auth console logging");
  }
}

function checkReleaseGateAndDocs() {
  const pkg = JSON.parse(read("package.json"));
  const scripts = pkg.scripts ?? {};

  if (!scripts["security:mobile-auth-otp-session-regression"]) {
    problems.push("package.json must define security:mobile-auth-otp-session-regression.");
  }

  const releaseMobile = scripts["release:mobile:p0"] ?? "";
  must("package.json#release:mobile:p0", releaseMobile, "pnpm security:mobile-auth-otp-session-regression");
  must("package.json#release:mobile:p0", releaseMobile, "pnpm security:mobile-auth");
  must("package.json#release:mobile:p0", releaseMobile, "pnpm test:mobile:p0");

  const mobileTestsScript = scripts["test:mobile:p0"] ?? "";
  any("package.json#test:mobile:p0", mobileTestsScript + " " + releaseMobile, ["auth", "otp", "mfa", "session", "mobile"]);

  const apiSecurity = scripts["test:api:security"] ?? "";
  must("package.json#test:api:security", apiSecurity, "pnpm security:mobile-auth-otp-session-regression");

  const runner = existsSync(join(root, "scripts/run-beta-critical-smoke.mjs"))
    ? read("scripts/run-beta-critical-smoke.mjs")
    : "";

  must("scripts/run-beta-critical-smoke.mjs", runner, "Mobile OTP/MFA session regression boundary guard");
  must("scripts/run-beta-critical-smoke.mjs", runner, "security:mobile-auth-otp-session-regression");

  for (const file of docsBoundaryFiles) {
    const source = read(file);

    for (const token of [
      "Mobile OTP/MFA session regression audit",
      "pnpm security:mobile-auth-otp-session-regression",
      "mfa_required",
      "OTP",
      "refresh",
      "logout",
      "SecureStore",
      "mobile P0",
      "does not expose accessToken",
      "does not expose refreshToken",
      "does not expose passwordHash",
      "does not expose cookie",
      "does not expose authorization"
    ]) {
      must(file, source, token);
    }
  }
}

if (problems.length > 0) {
  console.error("Mobile OTP/MFA session regression boundary failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Mobile OTP/MFA session regression boundary passed.");
