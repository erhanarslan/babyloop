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
    if (["node_modules", ".next", "dist", "coverage"].includes(entry)) continue;
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

function l(s) {
  return s.toLowerCase();
}

function corpus(files) {
  return files.filter((f) => existsSync(join(root, f))).map((f) => `\n// FILE ${f}\n${read(f)}`).join("\n");
}

function filesMatching(files, tokens) {
  return files.filter((f) => tokens.some((t) => l(f).includes(l(t))));
}

function must(label, source, token) {
  if (!l(source).includes(l(token))) problems.push(`${label} must contain ${JSON.stringify(token)}.`);
}

function any(label, source, tokens) {
  if (!tokens.some((t) => l(source).includes(l(t)))) problems.push(`${label} must contain one of ${JSON.stringify(tokens)}.`);
}

function not(label, source, pattern, desc) {
  if (pattern.test(source)) problems.push(`${label} must not contain ${desc}.`);
}

const apiSrc = walk("apps/api/src");
const apiTests = walk("apps/api/test");
const web = [...walk("apps/web/src"), ...walk("apps/web/e2e")];
const backoffice = walk("apps/backoffice/src");
const mobile = walk("apps/mobile/src");

const safetyTokens = ["report", "block", "moderation", "messag", "conversation", "profile"];
const apiSafetyFiles = filesMatching(apiSrc, safetyTokens);
const apiSafetyTestFiles = filesMatching(apiTests, safetyTokens);
const webSafetyFiles = filesMatching(web, [...safetyTokens, "listing"]);
const backofficeSafetyFiles = filesMatching(backoffice, ["moderation", "conversation", "profile", "report", "sensitive", "audit"]);
const mobileSafetyFiles = filesMatching(mobile, [...safetyTokens, "notification"]);

const docs = [
  "docs/25-validation-and-regression-checklist.md",
  "docs/32-backoffice-data-privacy-and-redaction.md",
  "docs/50-message-conversation-admin-review.md",
  "docs/54-production-env-checklist.md",
  "docs/55-beta-critical-smoke-checklist.md",
  "docs/58-beta-critical-smoke-automation.md",
  "docs/71-public-safety-abuse-flow-boundary.md",
  "docs/rag/06-messaging-and-privacy.md"
].filter((f) => existsSync(join(root, f)));

if (apiSafetyFiles.length === 0) problems.push("API safety corpus is empty.");
if (apiSafetyTestFiles.length === 0) problems.push("API safety test corpus is empty.");
if (backofficeSafetyFiles.length === 0) problems.push("Backoffice safety corpus is empty.");
if (!existsSync(join(root, "docs/71-public-safety-abuse-flow-boundary.md"))) problems.push("docs/71-public-safety-abuse-flow-boundary.md is required.");

if (problems.length === 0) {
  const api = corpus(apiSafetyFiles);
  const tests = corpus(apiSafetyTestFiles);
  const webText = corpus(webSafetyFiles);
  const backofficeText = corpus(backofficeSafetyFiles);
  const mobileText = corpus(mobileSafetyFiles);
  const docText = corpus(docs);

  for (const token of ["report", "message", "listing", "profile"]) must("API public safety corpus", api, token);

  any("message report API", api, ["/reports/messages", "/messages/:id", "messages/:id", "messageId", "message_id", "messageReport", "reportMessage", "report message", "message report", "message"]);
  any("listing report API", api, ["/reports/listings", "/listings/:id", "listings/:id", "listingId", "listing_id", "listingReport", "reportListing", "report listing", "listing report", "listing"]);
  any("profile report API", api, ["/reports/profiles", "/profiles/:id", "profiles/:id", "reportProfile", "profile report", "report profile"]);
  any("block/unblock API", api, ["/profiles/:id/block", "blockProfile", "blockedProfiles", "isProfilePairBlocked", "profile_blocked", "unblock"]);
  any("moderation fail-closed API", api, ["moderateMessageBody", "messageBlockedResponse", "blocked_by_moderation", "moderation", "unsafe"]);
  any("plaintext validation API", api, ["validatePlainText", "assertSafePlainText", "PlainText", "allowMultiline"]);
  any("messaging blocked API", api, ["profile_not_allowed", "profile_blocked", "canSendMessage", "MESSAGEABLE_LISTING_STATUSES", "getConversationAccess"]);
  any("auth/profile boundary API", api, ["requireCurrentUser", "currentUser", "profile.id", "recipientProfileId"]);

  for (const file of apiSafetyFiles) {
    const s = read(file);
    not(file, s, /passwordHash\s*:/u, "passwordHash response field");
    not(file, s, /refreshToken\s*:/u, "refreshToken response field");
    not(file, s, /accessToken\s*:/u, "accessToken response field");
    not(file, s, /document\.cookie/u, "document.cookie access");
    not(file, s, /localStorage/u, "localStorage persistence");
    not(file, s, /sessionStorage/u, "sessionStorage persistence");
  }

  for (const token of ["report", "message", "listing", "profile"]) must("API safety tests", tests, token);
  any("API block tests", tests, ["block", "blocked", "unblock", "profile_blocked", "isProfilePairBlocked"]);
  any("API moderation tests", tests, ["moderation", "unsafe", "blocked", "script", "html"]);
  any("API no-leak tests", tests, ["not.toHaveProperty", "not.toContain", "does not expose", "passwordHash", "accessToken", "refreshToken", "email", "phone"]);

  any("admin redaction", backofficeText + api, ["createRedactedMessagePreview", "bodyPreview", "redacted", "redaction", "safe text preview"]);
  any("sensitive access", backofficeText + api, ["sensitive-access", "sensitiveAccess", "reason", "fields", "adminAudit", "audit"]);
  any("admin guard", backofficeText + api, ["requireAdminUser", "admin", "RBAC", "role"]);

  any("web public safety surface", webText + docText, ["report", "block", "moderation", "blocked", "unsafe", "hidden menu"]);
  any("web hidden safety action", webText + docText, ["hidden", "menu", "kebab", "Report", "Block", "Engelle", "Şikayet"]);
  any("mobile safety surface or tracked gap", mobileText + docText, ["report", "block", "moderation", "mobile safety surface pending", "mobile report/block gap", "mobile abuse-flow gap"]);

  for (const file of docs) {
    const s = read(file);
    for (const token of [
      "Public safety abuse-flow audit",
      "pnpm security:public-safety-abuse-flow",
      "report/block/moderation",
      "admin redaction",
      "sensitive access",
      "does not expose email",
      "does not expose phone",
      "does not expose accessToken",
      "does not expose refreshToken",
      "does not expose passwordHash",
      "does not expose cookie",
      "does not expose authorization",
      "does not expose raw message body"
    ]) must(file, s, token);
  }

  must("public safety docs", docText, "fail-closed");
  must("public safety docs", docText, "hidden menu");
  must("public safety docs", docText, "mobile safety surface pending");

  const pkg = JSON.parse(read("package.json"));
  const scripts = pkg.scripts ?? {};
  if (!scripts["security:public-safety-abuse-flow"]) problems.push("package.json must define security:public-safety-abuse-flow.");
  must("package.json#test:api:security", scripts["test:api:security"] ?? "", "pnpm security:public-safety-abuse-flow");

  const runner = existsSync(join(root, "scripts/run-beta-critical-smoke.mjs")) ? read("scripts/run-beta-critical-smoke.mjs") : "";
  must("scripts/run-beta-critical-smoke.mjs", runner, "Public safety abuse-flow boundary guard");
  must("scripts/run-beta-critical-smoke.mjs", runner, "security:public-safety-abuse-flow");
}

if (problems.length > 0) {
  console.error("Public safety abuse-flow boundary failed:");
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log("Public safety abuse-flow boundary passed.");
