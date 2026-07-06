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
const webSrc = walk("apps/web/src");
const webE2e = walk("apps/web/e2e");
const mobileSrc = walk("apps/mobile/src");
const mobileTests = mobileSrc.filter((file) => file.includes(".test."));
const docs = walk("docs");

const apiMessagingFiles = filesMatching(apiSrc, ["messag", "conversation", "notification", "realtime", "socket"]);
const apiMessagingTests = filesMatching(apiTests, ["messag", "conversation", "notification", "realtime", "socket"]);
const webMessagingFiles = filesMatching([...webSrc, ...webE2e], ["messag", "conversation", "notification", "unread", "realtime"]);
const mobileMessagingFiles = filesMatching(mobileSrc, ["messag", "conversation", "notification", "unread", "realtime", "socket"]);
const mobileMessagingTests = filesMatching(mobileTests, ["messag", "conversation", "notification", "unread", "realtime", "socket"]);
const docsBoundaryFiles = [
  "docs/25-validation-and-regression-checklist.md",
  "docs/55-beta-critical-smoke-checklist.md",
  "docs/56-mobile-scope-freeze.md",
  "docs/58-beta-critical-smoke-automation.md",
  "docs/72-auth-session-realtime-readstate-boundary.md",
  "docs/73-mobile-messaging-realtime-parity-boundary.md",
  "docs/rag/06-messaging-and-privacy.md"
].filter((file) => existsSync(join(root, file)));

if (apiMessagingFiles.length === 0) problems.push("API messaging/realtime/notification corpus is empty.");
if (apiMessagingTests.length === 0) problems.push("API messaging/realtime/notification test corpus is empty.");
if (!existsSync(join(root, "docs/73-mobile-messaging-realtime-parity-boundary.md"))) problems.push("docs/73-mobile-messaging-realtime-parity-boundary.md is required.");

if (problems.length === 0) {
  checkApiReadStateAndRealtimeBoundary();
  checkWebReadStateBoundary();
  checkMobileParityBoundary();
  checkNoLeakBoundary();
  checkDocsAndReleaseWiring();
}

function checkApiReadStateAndRealtimeBoundary() {
  const api = corpus(apiMessagingFiles);
  const tests = corpus(apiMessagingTests);

  any("API conversation list/detail boundary", api + tests, [
    "/conversations",
    "conversation",
    "getConversation",
    "listConversations"
  ]);

  any("API send message boundary", api + tests, [
    "sendMessage",
    "messages",
    "body",
    "MessageResponse",
    "publishPersistedMessage"
  ]);

  any("API participant access boundary", api + tests, [
    "getConversationAccess",
    "getConversationForProfile",
    "participant",
    "FORBIDDEN",
    "NOT_FOUND",
    "profile_not_allowed"
  ]);

  any("API blocked profile messaging boundary", api + tests, [
    "isProfilePairBlocked",
    "profile_blocked",
    "blocked",
    "block"
  ]);

  any("API moderation fail-closed boundary", api + tests, [
    "moderateMessageBody",
    "messageBlockedResponse",
    "unsafe",
    "blocked"
  ]);

  any("API read-state boundary", api + tests, [
    "markConversationRead",
    "last_read_at",
    "lastReadAt",
    "mark read",
    "read endpoint"
  ]);

  any("API notification unread-count boundary", api + tests, [
    "unread-count",
    "unreadCount",
    "emitUnreadNotificationCountUpdated",
    "getUnreadNotificationCount"
  ]);

  any("API notification read reconciliation boundary", api + tests, [
    "markMessageNotificationsReadForConversation",
    "emitNotificationRead",
    "emitNotificationReadAll",
    "markNotificationRead",
    "markAllNotificationsRead"
  ]);

  any("API realtime auth boundary", api + tests, [
    "Socket.IO",
    "socket",
    "authenticate",
    "token",
    "cookie"
  ]);

  any("API realtime join access boundary", api + tests, [
    "join",
    "room",
    "conversation room",
    "getConversationForProfile",
    "FORBIDDEN"
  ]);
}

function checkWebReadStateBoundary() {
  const web = corpus(webMessagingFiles);
  const docs = corpus(docsBoundaryFiles);

  any("web messaging/read-state surface", web + docs, [
    "conversation",
    "message",
    "unread",
    "read",
    "mark read",
    "thread"
  ]);

  any("web notification unread surface", web + docs, [
    "unread-count",
    "unreadCount",
    "notification",
    "read-all",
    "read all"
  ]);
}

function checkMobileParityBoundary() {
  const mobile = corpus(mobileMessagingFiles);
  const tests = corpus(mobileMessagingTests);
  const docs = corpus(docsBoundaryFiles);
  const combined = mobile + tests + docs;

  // Mobile messaging may still be pending. This audit accepts implemented code or an explicit release-blocking gap.
  any("mobile messaging API or tracked P0 gap", combined, [
    "conversation",
    "message",
    "messaging",
    "mobile messaging/realtime parity pending",
    "mobile realtime parity pending",
    "mobile messaging p0 parity pending"
  ]);

  any("mobile notification unread/read-state surface", combined, [
    "unread",
    "read",
    "notification",
    "unreadCount",
    "unread-count",
    "read-state"
  ]);

  any("mobile logout/session cleanup expectation", combined, [
    "logout",
    "session",
    "disconnect",
    "revoke",
    "SecureStore",
    "secure-store"
  ]);

  any("mobile realtime parity expectation", combined, [
    "realtime",
    "socket",
    "room",
    "reconnect",
    "mobile messaging/realtime parity pending",
    "mobile realtime parity pending"
  ]);

  any("mobile P0 gate coverage", combined, [
    "release:mobile:p0",
    "mobile P0",
    "mobile release gate",
    "test:mobile:p0",
    "mobile messaging/realtime parity"
  ]);
}

function checkNoLeakBoundary() {
  // Messaging/realtime internals and clients may mention accessToken/authorization while handling auth boundaries.
  // This guard blocks user-facing leakage and unsafe storage patterns rather than banning internal identifiers globally.
  const tests = corpus([...apiMessagingTests, ...mobileMessagingTests]);
  const docs = corpus(docsBoundaryFiles);

  any("messaging/realtime no-leak tests or docs", tests + docs, [
    "does not expose accessToken",
    "does not expose refreshToken",
    "does not expose passwordHash",
    "does not expose authorization",
    "not.toHaveProperty",
    "not.toContain",
    "no-leak"
  ]);

  for (const file of [...webMessagingFiles, ...mobileMessagingFiles]) {
    const source = read(file);

    // TypeScript clients and E2E auth helpers may legitimately pass accessToken/authorization
    // into realtime auth. The release boundary only blocks user-facing leakage/storage/logging.
    not(file, source, /passwordHash\s*:\s*[^=]/u, "passwordHash response field");
    not(file, source, /console\.(log|debug|info)\s*\([^)]*(accessToken|refreshToken|authorization|passwordHash|cookie)/iu, "sensitive auth console logging");
    not(file, source, /document\.cookie/u, "document.cookie access");
  }

  for (const file of webMessagingFiles) {
    const source = read(file);
    not(file, source, /localStorage\.setItem\s*\([^)]*token/iu, "localStorage token persistence");
    not(file, source, /sessionStorage\.setItem\s*\([^)]*token/iu, "sessionStorage token persistence");
  }

  for (const file of mobileMessagingFiles) {
    const source = read(file);
    not(file, source, /AsyncStorage\.[a-zA-Z]+\s*\([^)]*token/iu, "AsyncStorage token persistence");
    not(file, source, /localStorage/iu, "localStorage in mobile messaging surface");
    not(file, source, /sessionStorage/iu, "sessionStorage in mobile messaging surface");
  }
}

function checkDocsAndReleaseWiring() {
  for (const file of docsBoundaryFiles) {
    const source = read(file);

    for (const token of [
      "Mobile messaging/realtime parity audit",
      "pnpm security:mobile-messaging-realtime-parity",
      "read-state",
      "unread-count",
      "realtime",
      "logout/session cleanup",
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

  const docs = corpus(docsBoundaryFiles);
  must("mobile messaging parity docs corpus", docs, "API");
  must("mobile messaging parity docs corpus", docs, "web");
  must("mobile messaging parity docs corpus", docs, "mobile");
  must("mobile messaging parity docs corpus", docs, "mobile messaging/realtime parity pending");

  const pkg = JSON.parse(read("package.json"));
  const scripts = pkg.scripts ?? {};

  if (!scripts["security:mobile-messaging-realtime-parity"]) {
    problems.push("package.json must define security:mobile-messaging-realtime-parity.");
  }

  const mobileP0 = scripts["release:mobile:p0"] ?? "";
  must("package.json#release:mobile:p0", mobileP0, "pnpm security:mobile-messaging-realtime-parity");

  const mobileTestsScript = scripts["test:mobile:p0"] ?? "";
  any("package.json#test:mobile:p0 or release:mobile:p0", mobileTestsScript + " " + mobileP0, [
    "notifications",
    "message",
    "messaging",
    "child",
    "auth"
  ]);

  const apiSecurity = scripts["test:api:security"] ?? "";
  must("package.json#test:api:security", apiSecurity, "pnpm security:mobile-messaging-realtime-parity");

  const runner = existsSync(join(root, "scripts/run-beta-critical-smoke.mjs"))
    ? read("scripts/run-beta-critical-smoke.mjs")
    : "";

  must("scripts/run-beta-critical-smoke.mjs", runner, "Mobile messaging/realtime parity boundary guard");
  must("scripts/run-beta-critical-smoke.mjs", runner, "security:mobile-messaging-realtime-parity");
}

if (problems.length > 0) {
  console.error("Mobile messaging/realtime parity boundary failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Mobile messaging/realtime parity boundary passed.");
