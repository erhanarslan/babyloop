#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const problems = [];
const textExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".md", ".json", ".yaml", ".yml"]);
const ignoredDirs = new Set([
  "node_modules",
  ".next",
  "dist",
  "coverage",
  ".turbo",
  "playwright-report",
  "test-results"
]);

function walk(dir) {
  const abs = join(root, dir);

  if (!existsSync(abs)) {
    return [];
  }

  const files = [];

  for (const entry of readdirSync(abs)) {
    if (ignoredDirs.has(entry)) {
      continue;
    }

    const full = join(abs, entry);
    const stat = statSync(full);

    if (stat.isDirectory()) {
      files.push(...walk(relative(root, full)));
      continue;
    }

    if (textExtensions.has(extname(entry))) {
      files.push(relative(root, full));
    }
  }

  return files;
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

function mustExist(file, label = file) {
  if (!existsSync(join(root, file))) {
    problems.push(`${label} is required.`);
  }
}

function mustContain(source, label, token) {
  if (!lower(source).includes(lower(token))) {
    problems.push(`${label} must contain ${JSON.stringify(token)}.`);
  }
}

function mustContainOne(source, label, tokens) {
  if (!tokens.some((token) => lower(source).includes(lower(token)))) {
    problems.push(`${label} must contain one of ${JSON.stringify(tokens)}.`);
  }
}

function mustNotMatch(source, label, pattern, description) {
  if (pattern.test(source)) {
    problems.push(`${label} must not contain ${description}.`);
  }
}

const requiredFiles = [
  "package.json",
  "scripts/run-beta-critical-smoke.mjs",
  "docs/76-core-safety-child-foundation.md",
  "apps/api/src/routes/child-profiles.routes.ts",
  "apps/api/src/schemas/child-profile-notes-reminders.schemas.ts",
  "apps/api/src/services/child-profile-notes-reminders.service.ts",
  "apps/api/src/services/child-reminder-delivery-candidates.service.ts",
  "apps/api/src/services/notification-delivery-log.service.ts",
  "apps/api/src/services/notification-consent-preference-policy.service.ts",
  "apps/api/src/services/saved-search-delivery-candidates.service.ts",
  "apps/api/src/services/child-lifecycle-notifications.service.ts",
  "apps/api/src/services/text-safety.service.ts",
  "apps/api/src/services/rag-pii-redaction.service.ts",
  "apps/api/src/services/rag-safety.service.ts",
  "apps/api/src/services/assistant-safety-guard.service.ts",
  "apps/api/test/child-profile-notes-reminders.routes.test.ts",
  "apps/api/test/child-profile-notes-reminders.schemas.test.ts",
  "apps/api/test/child-reminder-delivery-candidates.service.test.ts",
  "apps/api/test/notification-delivery-log.service.test.ts",
  "apps/api/test/notification-consent-preference-policy.service.test.ts",
  "apps/api/test/saved-search-delivery-candidates.service.test.ts",
  "apps/api/test/rag-pii-redaction.service.test.ts",
  "apps/api/test/rag-safety.service.test.ts",
  "apps/api/test/assistant-safety-guard.service.test.ts",
  "apps/api/test/image-storage-hardening.test.ts",
  "apps/api/test/listing-image-authenticity.integration.test.ts",
  "apps/api/test/admin-conversations.schemas.test.ts",
  "apps/api/test/admin-moderation.schemas.test.ts",
  "apps/api/test/admin-sensitive-access-audit.service.test.ts",
  "apps/api/test/redaction.service.test.ts",
  "apps/api/test/safety.integration.test.ts",
  "apps/web/src/features/child-profiles/api.ts",
  "apps/web/src/features/child-profiles/child-profiles-page-content.tsx",
  "apps/mobile/src/features/child/child-reminders-api.ts",
  "apps/mobile/src/features/child/child-reminders-api.test.ts",
  "apps/mobile/src/features/child/child-reminders-model.ts",
  "apps/mobile/src/features/child/child-reminders-model.test.ts",
  "apps/mobile/src/features/child/child-reminder-screen-state-model.ts",
  "apps/mobile/src/features/child/child-reminder-screen-state-model.test.ts"
];

for (const file of requiredFiles) {
  mustExist(file);
}

if (problems.length === 0) {
  checkPackageScripts();
  checkBetaRunner();
  checkDocs();
  checkChildNotebookAndReminderApi();
  checkReminderDeliveryAndNotificationPolicy();
  checkSavedSearchAndLifecycleCandidates();
  checkSecurityInventories();
  checkTokenAndLogLeakBoundaries();
  checkNoRealProviderActivation();
  checkWebAndMobileChildSurfaces();
}

function checkPackageScripts() {
  const scripts = JSON.parse(read("package.json")).scripts ?? {};

  mustContain(
    scripts["security:core-safety-child-foundation"] ?? "",
    "package.json#security:core-safety-child-foundation",
    "node scripts/check-core-safety-child-foundation-boundary.mjs"
  );
  mustContain(
    scripts["test:api:security"] ?? "",
    "package.json#test:api:security",
    "pnpm security:core-safety-child-foundation"
  );
  mustContain(
    scripts["release:mobile:p0"] ?? "",
    "package.json#release:mobile:p0",
    "pnpm security:core-safety-child-foundation"
  );
  mustContain(
    scripts["beta:critical-smoke"] ?? "",
    "package.json#beta:critical-smoke",
    "node scripts/run-beta-critical-smoke.mjs"
  );
}

function checkBetaRunner() {
  const runner = read("scripts/run-beta-critical-smoke.mjs");

  mustContain(runner, "scripts/run-beta-critical-smoke.mjs", "Core safety child foundation guard");
  mustContain(runner, "scripts/run-beta-critical-smoke.mjs", "security:core-safety-child-foundation");
  mustContain(runner, "scripts/run-beta-critical-smoke.mjs", "const steps = [");
}

function checkDocs() {
  const docs = read("docs/76-core-safety-child-foundation.md");

  for (const item of [
    "#169",
    "#170",
    "#171",
    "#172",
    "#173",
    "#174",
    "#175",
    "#176",
    "#177",
    "#178",
    "#179",
    "#180",
    "#181",
    "#182",
    "#183",
    "#184",
    "#185",
    "#186",
    "#187",
    "#188",
    "#189",
    "#190",
    "#191",
    "#192",
    "#193",
    "#194",
    "#195",
    "#196",
    "#197",
    "#198",
    "#199",
    "#200",
    "#201",
    "#202",
    "#203"
  ]) {
    mustContain(docs, "docs/76-core-safety-child-foundation.md backlog coverage", item);
  }

  mustContain(docs, "docs/76-core-safety-child-foundation.md", "Codex did not run tests");
  mustContain(docs, "docs/76-core-safety-child-foundation.md", "provider send remains disabled");
  mustContain(docs, "docs/76-core-safety-child-foundation.md", "No email sender");
  mustContain(docs, "docs/76-core-safety-child-foundation.md", "No push sender");
  mustContain(docs, "docs/76-core-safety-child-foundation.md", "No n8n webhook invocation");
  mustContain(docs, "docs/76-core-safety-child-foundation.md", "Real-device S22/Maestro");
}

function checkChildNotebookAndReminderApi() {
  const route = read("apps/api/src/routes/child-profiles.routes.ts");
  const schema = read("apps/api/src/schemas/child-profile-notes-reminders.schemas.ts");
  const service = read("apps/api/src/services/child-profile-notes-reminders.service.ts");
  const routeTests = read("apps/api/test/child-profile-notes-reminders.routes.test.ts");
  const schemaTests = read("apps/api/test/child-profile-notes-reminders.schemas.test.ts");

  for (const token of ["/notes", "/reminders", "app.get", "app.post", "app.patch", "app.delete"]) {
    mustContain(route, "child profile notes/reminders routes", token);
  }

  for (const token of ["validatePlainText", "normalizePlainText", ".strict()", "maxLength", "email_draft", "in_app"]) {
    mustContain(schema, "child profile notes/reminders schemas", token);
  }

  for (const token of ["ownsChildProfile", "childProfileNotes", "childProfileReminders", "isArchived", "cancelledAt", "completedAt"]) {
    mustContain(service, "child profile notes/reminders service", token);
  }

  mustContain(routeTests, "child notes/reminders route tests", "does not allow cross-user access");
  mustContain(routeTests, "child notes/reminders route tests", "rejects unsafe child note/reminder text");
  mustContain(routeTests, "child notes/reminders route tests", "not.toContain");
  mustContain(schemaTests, "child notes/reminders schema tests", "rejects HTML/script/control character abuse");
  mustContain(schemaTests, "child notes/reminders schema tests", "unknown fields");
  mustContain(schemaTests, "child notes/reminders schema tests", "channel: \"push\"");
}

function checkReminderDeliveryAndNotificationPolicy() {
  const candidate = read("apps/api/src/services/child-reminder-delivery-candidates.service.ts");
  const deliveryLog = read("apps/api/src/services/notification-delivery-log.service.ts");
  const policy = read("apps/api/src/services/notification-consent-preference-policy.service.ts");
  const candidateTests = read("apps/api/test/child-reminder-delivery-candidates.service.test.ts");
  const logTests = read("apps/api/test/notification-delivery-log.service.test.ts");
  const policyTests = read("apps/api/test/notification-consent-preference-policy.service.test.ts");

  for (const token of [
    "createNotificationDeliveryCandidateLog",
    "deliveryAllowed: false",
    "draftOnly: true",
    "frequency_window_active",
    "reminder_not_due",
    "reminder_not_scheduled"
  ]) {
    mustContain(candidate, "child reminder delivery candidates", token);
  }

  for (const token of ["buildNotificationDeliveryIdempotencyKey", "sanitizeNotificationMetadata", "blockedReasons"]) {
    mustContain(deliveryLog, "notification delivery log service", token);
  }

  for (const token of ["child_reminder", "saved_search", "child_lifecycle", "email", "push", "in_app", "n8n", "providerCallsAllowed: false"]) {
    mustContain(policy, "notification source/channel policy", token);
  }

  mustContain(candidateTests, "child reminder delivery candidate tests", "draft-only");
  mustContain(candidateTests, "child reminder delivery candidate tests", "frequency window");
  mustContain(candidateTests, "child reminder delivery candidate tests", "email_draft reminders without sending email");
  mustContain(logTests, "notification delivery log tests", "stable draft-only candidate log");
  mustContain(policyTests, "notification consent preference policy tests", "providerCallsAllowed");
}

function checkSavedSearchAndLifecycleCandidates() {
  const savedSearch = read("apps/api/src/services/saved-search-delivery-candidates.service.ts");
  const lifecycle = read("apps/api/src/services/child-lifecycle-notifications.service.ts");
  const savedSearchTests = read("apps/api/test/saved-search-delivery-candidates.service.test.ts");

  for (const token of ["saved_search", "deliveryAllowed: false", "draftOnly: true", "frequency_window_active", "createSavedSearchDeliveryCandidateLog"]) {
    mustContain(savedSearch, "saved search notification candidates", token);
  }

  for (const token of ["child_lifecycle", "ageBand", "cadence", "sağlık"]) {
    mustContain(lifecycle, "child lifecycle notification cadence", token);
  }

  mustContain(savedSearchTests, "saved search candidate tests", "idempotency");
  mustContain(savedSearchTests, "saved search candidate tests", "not.toMatch");
}

function checkSecurityInventories() {
  const apiSecurity = corpus([
    "apps/api/test/redaction.service.test.ts",
    "apps/api/test/admin-conversations.schemas.test.ts",
    "apps/api/test/admin-moderation.schemas.test.ts",
    "apps/api/test/admin-sensitive-access-audit.service.test.ts",
    "apps/api/test/safety.integration.test.ts",
    "apps/api/test/image-storage-hardening.test.ts",
    "apps/api/test/listing-image-authenticity.integration.test.ts",
    "apps/api/test/rag-pii-redaction.service.test.ts",
    "apps/api/test/rag-safety.service.test.ts",
    "apps/api/test/assistant-safety-guard.service.test.ts"
  ]);
  const routeAndScriptCorpus = corpus([
    ...walk("apps/api/src/routes"),
    ...walk("apps/api/src/plugins"),
    ...walk("scripts")
  ]);

  mustContain(apiSecurity, "public/admin DTO redaction tests", "passwordHash");
  mustContain(apiSecurity, "public/admin DTO redaction tests", "accessToken");
  mustContain(apiSecurity, "public/admin DTO redaction tests", "not.toContain");
  mustContain(apiSecurity, "sensitive access audit tests", "reason");
  mustContain(apiSecurity, "sensitive access audit tests", "fields");
  mustContain(apiSecurity, "file upload negative inventory", "magic");
  mustContain(apiSecurity, "file upload negative inventory", "mime");
  mustContain(apiSecurity, "RAG PII redaction inventory", "redact");
  mustContain(apiSecurity, "RAG medical refusal inventory", "medical");
  mustContain(apiSecurity, "AI provider fail-closed inventory", "fail");
  mustContainOne(apiSecurity, "block/report/moderation abuse flow inventory", ["block", "report", "moderation"]);

  mustContainOne(routeAndScriptCorpus, "CSRF mutation inventory", ["x-babyloop-csrf-token", "csrf"]);
  mustContainOne(routeAndScriptCorpus, "rate limit coverage inventory", ["rateLimit", "rate limit", "usage limit"]);
  mustContainOne(routeAndScriptCorpus, "SQL safe query/filter inventory", ["z.enum", "sort", "orderBy", "eq("]);
}

function checkTokenAndLogLeakBoundaries() {
  const mobileFiles = walk("apps/mobile/src");
  const publicAdminFiles = [
    ...walk("apps/api/src/routes"),
    ...walk("apps/api/src/schemas"),
    ...walk("apps/api/src/services"),
    ...walk("apps/web/src"),
    ...walk("apps/backoffice/src"),
    ...mobileFiles
  ];

  for (const file of mobileFiles) {
    const source = read(file);

    mustNotMatch(source, file, /\bAsyncStorage\b[\s\S]{0,160}\b(accessToken|refreshToken|token)\b/iu, "AsyncStorage token persistence");
    mustNotMatch(source, file, /\blocalStorage\b[\s\S]{0,160}\b(accessToken|refreshToken|token)\b/iu, "localStorage token persistence");
    mustNotMatch(source, file, /\bsessionStorage\b[\s\S]{0,160}\b(accessToken|refreshToken|token)\b/iu, "sessionStorage token persistence");
    mustNotMatch(source, file, /document\.cookie/iu, "document.cookie token access");
  }

  for (const file of publicAdminFiles) {
    const source = read(file);

    mustNotMatch(
      source,
      file,
      /console\.(log|debug|info|warn|error)\s*\([^)]*(accessToken|refreshToken|passwordHash|authorization|cookie|otp|webhookSecret|providerSecret)/iu,
      "sensitive console logging"
    );
    mustNotMatch(
      source,
      file,
      /JSON\.stringify\s*\([^)]*(accessToken|refreshToken|passwordHash|authorization|cookie|otp|webhookSecret|providerSecret)/iu,
      "raw sensitive JSON stringify"
    );
  }
}

function checkNoRealProviderActivation() {
  const providerCorpus = corpus([
    "apps/api/src/services/notification-consent-preference-policy.service.ts",
    "apps/api/src/services/child-reminder-delivery-candidates.service.ts",
    "apps/api/src/services/saved-search-delivery-candidates.service.ts",
    "docs/76-core-safety-child-foundation.md"
  ]);

  mustContain(providerCorpus, "provider disabled boundary", "deliveryAllowed: false");
  mustContain(providerCorpus, "provider disabled boundary", "draftOnly: true");
  mustContain(providerCorpus, "provider disabled boundary", "providerCallsAllowed: false");
  mustContain(providerCorpus, "provider disabled boundary", "No email sender");
  mustContain(providerCorpus, "provider disabled boundary", "No push sender");
  mustContain(providerCorpus, "provider disabled boundary", "No n8n webhook invocation");
  mustNotMatch(providerCorpus, "provider disabled boundary", /send(?:Email|Push)\s*\(/u, "real email/push send call");
  mustNotMatch(providerCorpus, "provider disabled boundary", /fetch\s*\([^)]*n8n/iu, "real n8n webhook call");
}

function checkWebAndMobileChildSurfaces() {
  const web = corpus([
    "apps/web/src/features/child-profiles/api.ts",
    "apps/web/src/features/child-profiles/child-profiles-page-content.tsx"
  ]);
  const mobile = corpus([
    "apps/mobile/src/features/child/child-reminders-api.ts",
    "apps/mobile/src/features/child/child-reminders-model.ts",
    "apps/mobile/src/features/child/child-reminder-screen-state-model.ts",
    "apps/mobile/src/features/child/child-reminders-api.test.ts",
    "apps/mobile/src/features/child/child-reminder-screen-state-model.test.ts"
  ]);

  mustContain(web, "web child notebook/reminder surface", "notes");
  mustContain(web, "web child notebook/reminder surface", "reminders");
  mustContainOne(web, "web child empty/loading/error states", ["empty", "loading", "error"]);
  mustContain(mobile, "mobile child reminder API surface", "/api/v1/child-profiles");
  mustContainOne(mobile, "mobile child empty/loading/error states", ["empty", "loading", "error"]);
}

if (problems.length > 0) {
  console.error("Core safety child foundation boundary failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Core safety child foundation boundary passed.");
