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

function scriptMustContain(scripts, name, token) {
  const value = scripts[name] ?? "";
  if (!value.includes(token)) {
    problems.push(`package.json#${name} must contain ${JSON.stringify(token)}.`);
  }
}

const apiSrc = walk("apps/api/src");
const apiTests = walk("apps/api/test");
const webSrc = walk("apps/web/src");
const webE2e = walk("apps/web/e2e");
const backofficeSrc = walk("apps/backoffice/src");
const backofficeTests = walk("apps/backoffice/src").filter((file) => file.includes(".test."));
const mobileSrc = walk("apps/mobile/src");
const docs = walk("docs");

const apiAuthFiles = filesMatching(apiSrc, ["auth", "session", "cookie", "csrf", "security"]);
const apiRealtimeFiles = filesMatching(apiSrc, ["realtime", "socket", "messag", "conversation", "notification"]);
const apiAuthTests = filesMatching(apiTests, ["auth", "cookie", "csrf", "refresh", "session"]);
const apiRealtimeTests = filesMatching(apiTests, ["realtime", "socket", "messag", "conversation", "notification"]);
const webAuthFiles = filesMatching([...webSrc, ...webE2e], ["auth", "login", "logout", "csrf", "session", "messag", "notification"]);
const backofficeAuthFiles = filesMatching([...backofficeSrc, ...backofficeTests], ["auth", "csrf", "admin", "login", "moderation", "notification", "conversation"]);
const mobileAuthFiles = filesMatching(mobileSrc, ["auth", "session", "secure", "login", "logout", "notification", "messag"]);
const docsBoundaryFiles = [
  "docs/25-validation-and-regression-checklist.md",
  "docs/54-production-env-checklist.md",
  "docs/55-beta-critical-smoke-checklist.md",
  "docs/56-mobile-scope-freeze.md",
  "docs/58-beta-critical-smoke-automation.md",
  "docs/72-auth-session-realtime-readstate-boundary.md",
  "docs/rag/06-messaging-and-privacy.md"
].filter((file) => existsSync(join(root, file)));

if (apiAuthFiles.length === 0) problems.push("API auth/session/cookie corpus is empty.");
if (apiRealtimeFiles.length === 0) problems.push("API realtime/messaging/notification corpus is empty.");
if (apiAuthTests.length === 0) problems.push("API auth/cookie/csrf test corpus is empty.");
if (apiRealtimeTests.length === 0) problems.push("API realtime/messaging/notification test corpus is empty.");
if (!existsSync(join(root, "docs/72-auth-session-realtime-readstate-boundary.md"))) problems.push("docs/72-auth-session-realtime-readstate-boundary.md is required.");

if (problems.length === 0) {
  checkApiAuthSessionCookieBoundary();
  checkCsrfBoundary();
  checkBackofficeAuthBoundary();
  checkRealtimeAndReadStateBoundary();
  checkWebMobileSurfaceBoundary();
  checkNoLeakBoundary();
  checkDocsAndReleaseWiring();
}

function checkApiAuthSessionCookieBoundary() {
  const apiAuth = corpus(apiAuthFiles);
  const tests = corpus(apiAuthTests);

  for (const token of ["register", "login", "logout", "refresh"]) {
    must("API auth/session corpus", apiAuth + tests, token);
  }

  any("API /auth/me boundary", apiAuth + tests, ["/auth/me", "auth/me", "getCurrentUser", "current user", "me"]);
  any("httpOnly cookie boundary", apiAuth + tests, ["httpOnly", "httponly"]);
  any("sameSite cookie boundary", apiAuth + tests, ["sameSite", "samesite"]);
  any("secure cookie boundary", apiAuth + tests, ["secure:", "secure cookie", "isProduction", "node_env", "NODE_ENV", "production", "secureCookie", "cookieSecure"]);
  any("refresh/session revoke boundary", apiAuth + tests, ["revoke", "revoked", "session", "refreshToken", "refresh token"]);
  any("public access cookie boundary", apiAuth + tests, ["public access", "public-access", "access-token cookie", "publicAccessToken", "public_access"]);
  any("cookie migration boundary", apiAuth + tests, ["cookie migration", "public-auth-cookie", "access token cookie", "backoffice access token cookie", "refresh token cookie"]);

  any("auth negative tests", tests, ["401", "unauthenticated", "invalid", "expired", "forbidden", "logout"]);
}

function checkCsrfBoundary() {
  const apiAuth = corpus(apiAuthFiles);
  const tests = corpus(apiAuthTests);
  const backoffice = corpus(backofficeAuthFiles);
  const web = corpus(webAuthFiles);

  any("public CSRF token boundary", apiAuth + tests + web, ["x-babyloop-csrf-token", "csrf", "CSRF"]);
  any("CSRF mutation protection", apiAuth + tests, ["csrf", "mutation", "POST", "PUT", "PATCH", "DELETE"]);
  any("CSRF failure tests", tests, ["403", "csrf", "missing csrf", "invalid csrf"]);
  any("backoffice CSRF boundary", backoffice + tests, ["backoffice", "csrf", "x-babyloop-csrf-token", "admin"]);
}

function checkBackofficeAuthBoundary() {
  const backoffice = corpus(backofficeAuthFiles);
  const tests = corpus(apiAuthTests);

  any("backoffice cookie auth boundary", backoffice + tests, ["backoffice", "admin", "cookie", "login"]);
  any("backoffice admin guard boundary", backoffice + tests, ["requireAdminUser", "non-admin", "forbidden", "admin role", "RBAC"]);
  any("backoffice route protection", backoffice + tests, ["/admin", "admin moderation", "admin notifications", "admin dashboard"]);
}

function checkRealtimeAndReadStateBoundary() {
  const apiRealtime = corpus(apiRealtimeFiles);
  const tests = corpus(apiRealtimeTests);

  any("realtime socket auth", apiRealtime + tests, ["socket", "Socket.IO", "io", "authenticate", "token", "cookie"]);
  any("realtime room join access control", apiRealtime + tests, ["join", "conversation", "room", "getConversationForProfile", "getConversationAccess", "FORBIDDEN", "NOT_FOUND"]);
  any("realtime persisted message publishing", apiRealtime + tests, ["publishPersistedMessage", "MessageResponse", "conversation updated", "message"]);
  any("logout disconnect or session cleanup", apiRealtime + tests, ["logout", "disconnect", "revoke", "session"]);
  any("message read-state boundary", apiRealtime + tests, ["markConversationRead", "mark read", "last_read_at", "lastReadAt"]);
  any("notification unread count boundary", apiRealtime + tests, ["unread-count", "unreadCount", "emitUnreadNotificationCountUpdated", "notification unread"]);
  any("notification read event boundary", apiRealtime + tests, ["emitNotificationRead", "emitNotificationReadAll", "markNotificationRead", "markAllNotificationsRead"]);
  any("message notification read reconciliation", apiRealtime + tests, ["markMessageNotificationsReadForConversation", "message notifications", "conversation messages"]);
}

function checkWebMobileSurfaceBoundary() {
  const web = corpus(webAuthFiles);
  const mobile = corpus(mobileAuthFiles);
  const docs = corpus(docsBoundaryFiles);

  any("web auth/session surface", web + docs, ["login", "logout", "refresh", "csrf", "session", "protected"]);
  any("web read-state surface", web + docs, ["unread", "read", "notification", "conversation", "message"]);
  any("mobile auth/session surface", mobile + docs, ["SecureStore", "secure-store", "session", "login", "logout", "refresh"]);
  any("mobile realtime/read-state documented parity", mobile + docs, ["realtime", "socket", "unread", "read-state", "mobile messaging/realtime parity pending", "mobile realtime parity pending"]);
}

function checkNoLeakBoundary() {
  // Auth internals must necessarily mention accessToken/refreshToken/passwordHash/authorization.
  // This boundary therefore checks user-facing leakage points instead of banning internal identifiers globally.
  const tests = corpus([...apiAuthTests, ...apiRealtimeTests]);
  const docs = corpus(docsBoundaryFiles);

  any("auth/session no-leak tests", tests + docs, [
    "does not expose accessToken",
    "does not expose refreshToken",
    "does not expose passwordHash",
    "does not expose authorization",
    "not.toHaveProperty",
    "not.toContain",
    "httpOnly",
    "cookie"
  ]);

  const storageSensitiveFiles = [...webAuthFiles, ...mobileAuthFiles];
  for (const file of storageSensitiveFiles) {
    const source = read(file);
    if (file.startsWith("apps/web/")) {
      not(file, source, /localStorage\.setItem\s*\([^)]*token/iu, "localStorage token persistence");
      not(file, source, /sessionStorage\.setItem\s*\([^)]*token/iu, "sessionStorage token persistence");
    }
    if (file.startsWith("apps/mobile/")) {
      not(file, source, /AsyncStorage\.[a-zA-Z]+\s*\([^)]*token/iu, "AsyncStorage token persistence");
      not(file, source, /localStorage/iu, "localStorage in mobile auth surface");
      not(file, source, /sessionStorage/iu, "sessionStorage in mobile auth surface");
    }
  }
}

function checkDocsAndReleaseWiring() {
  const docs = corpus(docsBoundaryFiles);

  for (const file of docsBoundaryFiles) {
    const source = read(file);

    for (const token of [
      "Auth/session/CSRF/realtime/read-state audit",
      "pnpm security:auth-session-realtime-readstate",
      "httpOnly",
      "CSRF",
      "realtime",
      "read-state",
      "unread-count",
      "release dependency map",
      "does not expose accessToken",
      "does not expose refreshToken",
      "does not expose passwordHash",
      "does not expose cookie",
      "does not expose authorization"
    ]) {
      must(file, source, token);
    }
  }

  must("auth/session realtime docs corpus", docs, "API");
  must("auth/session realtime docs corpus", docs, "web");
  must("auth/session realtime docs corpus", docs, "backoffice");
  must("auth/session realtime docs corpus", docs, "mobile");
  must("auth/session realtime docs corpus", docs, "mobile messaging/realtime parity pending");

  const pkg = JSON.parse(read("package.json"));
  const scripts = pkg.scripts ?? {};

  if (!scripts["security:auth-session-realtime-readstate"]) {
    problems.push("package.json must define security:auth-session-realtime-readstate.");
  }

  scriptMustContain(scripts, "test:api:security", "pnpm security:auth-session-realtime-readstate");

  const runner = existsSync(join(root, "scripts/run-beta-critical-smoke.mjs"))
    ? read("scripts/run-beta-critical-smoke.mjs")
    : "";

  must("scripts/run-beta-critical-smoke.mjs", runner, "Auth/session/CSRF/realtime/read-state boundary guard");
  must("scripts/run-beta-critical-smoke.mjs", runner, "security:auth-session-realtime-readstate");
}

if (problems.length > 0) {
  console.error("Auth/session/CSRF/realtime/read-state boundary failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Auth/session/CSRF/realtime/read-state boundary passed.");
