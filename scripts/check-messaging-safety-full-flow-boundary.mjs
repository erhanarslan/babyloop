#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";

const problems = [];

const requiredFiles = [
  "apps/api/src/routes/messaging.routes.ts",
  "apps/api/src/schemas/messaging.schemas.ts",
  "apps/api/src/services/messaging.service.ts",
  "apps/api/src/realtime/publisher.ts",
  "apps/api/src/realtime/socket.ts",
  "apps/api/src/services/admin-conversations.service.ts",
  "apps/api/src/services/admin-moderation.service.ts",
  "apps/api/test/messaging.integration.test.ts",
  "apps/api/test/realtime.integration.test.ts",
  "apps/api/test/moderation.integration.test.ts",
  "apps/api/test/admin-moderation.integration.test.ts",
  "apps/api/test/admin-moderation.schemas.test.ts",
  "apps/api/test/admin-moderation.timeline.test.ts",
  "apps/api/test/admin-conversations.schemas.test.ts",
  "apps/web/e2e/messaging-safety.smoke.spec.ts",
  "docs/20-messaging-implementation-plan.md",
  "docs/32-backoffice-data-privacy-and-redaction.md",
  "docs/50-message-conversation-admin-review.md",
  "docs/rag/06-messaging-and-privacy.md",
  "docs/55-beta-critical-smoke-checklist.md",
  "docs/58-beta-critical-smoke-automation.md",
  "docs/69-messaging-safety-full-flow-boundary.md",
  "scripts/run-beta-critical-smoke.mjs",
  "package.json"
];

for (const file of requiredFiles) {
  if (!existsSync(`${process.cwd()}/${file}`)) {
    problems.push(`Missing messaging safety full-flow boundary file: ${file}`);
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

function mustContainAnyCaseInsensitive(source, file, tokens) {
  const lowerSource = source.toLowerCase();
  if (!tokens.some((token) => lowerSource.includes(token.toLowerCase()))) {
    problems.push(`${file} must contain one of ${JSON.stringify(tokens)}.`);
  }
}

function assertOrder(source, file, orderedTokens) {
  let cursor = -1;

  for (const token of orderedTokens) {
    const next = source.indexOf(token, cursor + 1);

    if (next === -1) {
      problems.push(`${file} must contain ${JSON.stringify(token)} after the previous boundary token.`);
      return;
    }

    cursor = next;
  }
}

if (problems.length === 0) {
  checkMessageRoutePreSendBoundary();
  checkMessageSchemaAndServiceDtoBoundary();
  checkRealtimeBoundary();
  checkAdminConversationRedactionBoundary();
  checkApiAndE2eRegressionCoverage();
  checkPackageAndBetaSmokeWiring();
  checkDocs();
}

function checkMessageRoutePreSendBoundary() {
  const file = "apps/api/src/routes/messaging.routes.ts";
  const source = read(file);

  for (const token of [
    "moderateMessageBody(parsedBody.data.body)",
    "!moderation.allowed",
    "messageBlockedResponse()",
    "sendMessage(app",
    "createMessageReceivedNotifications(app",
    "publishPersistedMessage(app",
    "profileBlockedResponse()",
    "profileNotAllowedToMessageResponse()",
    "safePlainTextFallback",
    "markMessageNotificationsReadForConversation"
  ]) {
    mustContain(source, file, token);
  }

  assertOrder(source, file, [
    "moderateMessageBody(parsedBody.data.body)",
    "!moderation.allowed",
    "sendMessage(app"
  ]);
  assertOrder(source, file, [
    "sendMessage(app",
    "createMessageReceivedNotifications(app",
    "publishPersistedMessage(app"
  ]);
}

function checkMessageSchemaAndServiceDtoBoundary() {
  const schemaFile = "apps/api/src/schemas/messaging.schemas.ts";
  const serviceFile = "apps/api/src/services/messaging.service.ts";
  const schema = read(schemaFile);
  const service = read(serviceFile);

  for (const token of [
    "validatePlainText(value",
    "allowMultiline: true",
    "maxLength: 500",
    "minLength: 1",
    ".strict()"
  ]) {
    mustContain(schema, schemaFile, token);
  }

  for (const token of [
    "ConversationSummaryResponse",
    "otherProfile",
    "displayName",
    "contextListing",
    "latestMessage",
    "MessageResponse",
    "sender",
    "body",
    "getConversationAccess",
    "isProfilePairBlocked",
    "canSendMessage",
    "profile_not_allowed",
    "profile_blocked",
    "MESSAGEABLE_LISTING_STATUSES"
  ]) {
    mustContain(service, serviceFile, token);
  }

  for (const forbidden of [
    "email: users.email",
    "phone: users.phone",
    "passwordHash",
    "refreshToken",
    "accessToken"
  ]) {
    mustNotContain(service, serviceFile, forbidden);
  }
}

function checkRealtimeBoundary() {
  const socketFile = "apps/api/src/realtime/socket.ts";
  const publisherFile = "apps/api/src/realtime/publisher.ts";
  const socket = read(socketFile);
  const publisher = read(publisherFile);

  for (const token of [
    "authenticateAccessToken",
    "readPublicAccessTokenCookie",
    "handleConversationJoin",
    "conversationParamsSchema.safeParse",
    "getConversationForProfile(",
    "socket.data.currentUser.profile.id",
    "emitRealtimeError(socket, result.status === \"not_found\" ? \"NOT_FOUND\" : \"FORBIDDEN\")",
    "socket.join(realtimeConversationRoom(parsedPayload.data.id))",
    "realtimeProfileRoom(currentUser.profile.id)"
  ]) {
    mustContain(socket, socketFile, token);
  }

  for (const token of [
    "publishPersistedMessage",
    "emitMessageCreated",
    "emitConversationUpdated",
    "listConversationParticipantProfileIds",
    "getConversationSummaryForProfile",
    "realtimeConversationRoom(payload.conversationId)",
    "realtimeProfileRoom(profileId)",
    "REALTIME_EVENTS.messageCreated",
    "REALTIME_EVENTS.conversationUpdated"
  ]) {
    mustContain(publisher, publisherFile, token);
  }

  for (const forbidden of [
    "users.email",
    "users.phone",
    "passwordHash",
    "refreshTokenHash",
    "set-cookie"
  ]) {
    mustNotContain(publisher, publisherFile, forbidden);
  }
}

function checkAdminConversationRedactionBoundary() {
  const adminConversationFile = "apps/api/src/services/admin-conversations.service.ts";
  const adminModerationFile = "apps/api/src/services/admin-moderation.service.ts";
  const adminConversation = read(adminConversationFile);
  const adminModeration = read(adminModerationFile);

  for (const token of [
    "bodyPreview: createRedactedMessagePreview",
    "createRedactedMessagePreview",
    "[redacted-contact]",
    "reportedMessageCount",
    "openCaseCount",
    "enforcementCount",
    "loadMessageModerationCases",
    "loadMessageEnforcementHistory"
  ]) {
    mustContain(adminConversation, adminConversationFile, token);
  }

  for (const token of [
    "AdminModerationSensitiveAccessResult",
    "sensitive",
    "message?:",
    "body: string",
    "auditEventId",
    "recordSensitiveAccessGranted",
    "recordSensitiveAccessDenied"
  ]) {
    mustContain(adminModeration, adminModerationFile, token);
  }
}

function checkApiAndE2eRegressionCoverage() {
  const messagingTestFile = "apps/api/test/messaging.integration.test.ts";
  const realtimeTestFile = "apps/api/test/realtime.integration.test.ts";
  const moderationTestFile = "apps/api/test/moderation.integration.test.ts";
  const adminModerationIntegrationTestFile = "apps/api/test/admin-moderation.integration.test.ts";
  const adminModerationSchemasTestFile = "apps/api/test/admin-moderation.schemas.test.ts";
  const adminModerationTimelineTestFile = "apps/api/test/admin-moderation.timeline.test.ts";
  const adminSchemasTestFile = "apps/api/test/admin-conversations.schemas.test.ts";
  const webMessagingSafetyFile = "apps/web/e2e/messaging-safety.smoke.spec.ts";

  const messagingTest = read(messagingTestFile);
  const realtimeTest = read(realtimeTestFile);
  const moderationTest = [
    read(moderationTestFile),
    read(adminModerationIntegrationTestFile),
    read(adminModerationSchemasTestFile),
    read(adminModerationTimelineTestFile)
  ].join("\n");
  const moderationCoverageFile = "apps/api/test/moderation.integration.test.ts + admin-moderation tests";
  const adminSchemasTest = read(adminSchemasTestFile);
  const webMessagingSafety = read(webMessagingSafetyFile);

  for (const token of [
    "returns 401 for unauthenticated conversation create",
    "prevents seller messaging own listing",
    "returns only current user's conversations",
    "blocks non-participants",
    "blocks non-participants from reading thread",
    "rejects dangerous HTML/script-like message bodies before persistence or realtime",
    "persistedMessages",
    "createdNotifications",
    "expect(emitSpy).not.toHaveBeenCalled()",
    "accepts valid Turkish and multiline plaintext messages"
  ]) {
    mustContain(messagingTest, messagingTestFile, token);
  }

  for (const token of [
    "messaging realtime API",
    "accepts socket authentication from the public access cookie",
    "publishes realtime events after message persistence",
    "realtimeError",
    "FORBIDDEN",
    "blockedEvents",
    "expect(blockedEvents).toHaveLength(0)",
    "waitForConversationRoomSize"
  ]) {
    mustContain(realtimeTest, realtimeTestFile, token);
  }

  for (const token of [
    "message",
    "report",
    "moderation",
    "sensitive-access",
    "redacted"
  ]) {
    mustContainCaseInsensitive(moderationTest, moderationCoverageFile, token);
  }

  for (const token of [
    "bodyPreview: \"[redacted-contact] delivery question\"",
    "adminConversationDetailResponseSchema",
    "adminConversationsResponseSchema"
  ]) {
    mustContain(adminSchemasTest, adminSchemasTestFile, token);
  }

  for (const token of [
    "messaging safety",
    "unsafeSendRequests",
    "blocked"
  ]) {
    mustContainCaseInsensitive(webMessagingSafety, webMessagingSafetyFile, token);
  }
}

function checkPackageAndBetaSmokeWiring() {
  const packageData = JSON.parse(read("package.json"));
  const scripts = packageData.scripts ?? {};

  mustContain(
    scripts["security:messaging-safety-full-flow"] ?? "",
    "package.json#security:messaging-safety-full-flow",
    "node scripts/check-messaging-safety-full-flow-boundary.mjs"
  );
  mustContain(
    scripts["test:api:security"] ?? "",
    "package.json#test:api:security",
    "pnpm security:messaging-safety-full-flow"
  );

  const runner = read("scripts/run-beta-critical-smoke.mjs");
  mustContain(runner, "scripts/run-beta-critical-smoke.mjs", "Messaging safety full-flow boundary guard");
  mustContain(runner, "scripts/run-beta-critical-smoke.mjs", "security:messaging-safety-full-flow");
}

function checkDocs() {
  for (const file of [
    "docs/69-messaging-safety-full-flow-boundary.md",
    "docs/20-messaging-implementation-plan.md",
    "docs/32-backoffice-data-privacy-and-redaction.md",
    "docs/50-message-conversation-admin-review.md",
    "docs/rag/06-messaging-and-privacy.md",
    "docs/55-beta-critical-smoke-checklist.md",
    "docs/58-beta-critical-smoke-automation.md"
  ]) {
    const source = read(file);

    mustContainCaseInsensitive(source, file, "messaging safety full-flow boundary");
    mustContain(source, file, "pnpm security:messaging-safety-full-flow");
    mustContainCaseInsensitive(source, file, "unsafe message bodies are rejected before persistence");
    mustContainCaseInsensitive(source, file, "does not add a new realtime provider");
    mustContainAnyCaseInsensitive(source, file, [
      "does not expose email",
      "do not expose email",
      "must not expose email"
    ]);
    mustContainAnyCaseInsensitive(source, file, [
      "does not expose phone",
      "do not expose phone",
      "must not expose phone"
    ]);
    mustContainAnyCaseInsensitive(source, file, [
      "does not expose accessToken",
      "do not expose accessToken",
      "must not expose accessToken"
    ]);
    mustContainAnyCaseInsensitive(source, file, [
      "does not expose refreshToken",
      "do not expose refreshToken",
      "must not expose refreshToken"
    ]);
    mustContainAnyCaseInsensitive(source, file, [
      "does not expose cookie",
      "do not expose cookie",
      "must not expose cookie"
    ]);
    mustContainAnyCaseInsensitive(source, file, [
      "does not expose authorization",
      "do not expose authorization",
      "must not expose authorization"
    ]);
  }
}

if (problems.length > 0) {
  console.error("Messaging safety full-flow boundary failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Messaging safety full-flow boundary passed.");
