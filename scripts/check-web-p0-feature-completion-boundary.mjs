#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];

function read(relativePath) {
  const absolutePath = join(root, relativePath);

  if (!existsSync(absolutePath)) {
    failures.push(`Missing required file: ${relativePath}`);
    return "";
  }

  return readFileSync(absolutePath, "utf8");
}

function requireIncludes(relativePath, snippets) {
  const source = read(relativePath);

  for (const snippet of snippets) {
    if (!source.includes(snippet)) {
      failures.push(`${relativePath} must include ${JSON.stringify(snippet)}`);
    }
  }

  return source;
}

function requireExcludes(relativePath, snippets) {
  const source = read(relativePath);

  for (const snippet of snippets) {
    if (source.includes(snippet)) {
      failures.push(`${relativePath} must not include ${JSON.stringify(snippet)}`);
    }
  }

  return source;
}

requireIncludes("apps/web/src/lib/auth-client.ts", [
  "fetchCurrentUserWithoutRefreshPromise",
  "refreshSessionPromise",
  "isSessionRejectionStatus",
  "apiUnavailableResponse",
  "manuallyLoggedOut"
]);
requireExcludes("apps/web/src/components/auth-nav.tsx", [
  "setInterval(",
  "5000"
]);
requireIncludes("apps/web/src/components/auth-nav.tsx", [
  "loadWithRefresh",
  "AUTH_SESSION_ENDED_EVENT",
  "visibilitychange"
]);

requireIncludes("apps/web/src/features/auth/web-login-flow-model.ts", [
  "normalizeWebOtpCode",
  "canSubmitWebOtpCode",
  "transitionWebLoginFlowFromSubmit",
  "transitionWebLoginFlowFromMfaVerify"
]);
requireIncludes("apps/web/src/features/auth/web-login-flow-model.test.ts", [
  "MFA required",
  "6 digit OTP",
  "mobile approval"
]);
requireExcludes("apps/web/src/features/account/account-profile-page-content.tsx", [
  "Güvenilir cihazlar",
  "yakında",
  "disabled coming"
]);
requireIncludes("apps/web/src/features/account/account-security-page-content.tsx", [
  "id=\"password\"",
  "id=\"mfa\"",
  "id=\"sessions\"",
  "<ChangePasswordForm",
  "<MfaSettingsPanel",
  "<SessionManagementPanel"
]);
requireIncludes("apps/web/src/app/account/security/page.tsx", [
  "AccountSecurityPageContent",
  "buildNoIndexMetadata"
]);
requireIncludes("apps/web/src/app/account/password/page.tsx", [
  "redirect(\"/account/security#password\")"
]);

requireIncludes("apps/web/src/features/assistant/api.ts", [
  "/api/v1/assistant/messages"
]);
requireIncludes("apps/web/src/features/assistant/assistant-response-model.ts", [
  "sourcePath",
  "isSafeWebAssistantHref",
  "javascript:",
  "data:",
  "mode",
  "grounded",
  "sources"
]);
requireIncludes("apps/web/src/features/assistant/assistant-response-model.test.ts", [
  "sourcePath",
  "javascript",
  "no_sources",
  "boundary"
]);
requireExcludes("apps/web/src/features/assistant/assistant-page-content.tsx", [
  "<a href={",
  "sourcePath",
  "providerName",
  "promptVersion"
]);

requireIncludes("apps/web/src/features/listings/api.ts", [
  "/api/v1/listings/ai-draft-suggestions"
]);
requireIncludes("apps/web/src/features/listings/web-ai-listing-draft-model.ts", [
  "buildWebAiListingDraftApplyPatch",
  "shouldMarkWebAiListingDraftStale",
  "priceSuggestion",
  "missingDetails",
  "warnings"
]);
requireIncludes("apps/web/src/features/listings/web-ai-listing-draft-model.test.ts", [
  "preserves existing user fields",
  "price",
  "condition",
  "stale"
]);
requireIncludes("apps/web/src/features/listings/sell-listing-form.tsx", [
  "Boş alanlara uygula",
  "Yeniden analiz et",
  "Taslak eski olabilir",
  "handleGenerateDraftSuggestion"
]);
requireExcludes("apps/web/src/features/listings/sell-listing-form.tsx", [
  "providerName",
  "promptVersion",
  "modelName"
]);

requireExcludes("apps/web/src/features/child-profiles/child-profiles-page-content.tsx", [
  "buildNotebookPreviewItems",
  "2 saatte bir"
]);
requireIncludes("apps/web/src/features/child-profiles/child-profiles-page-content.tsx", [
  "Henüz not veya hatırlatıcı yok.",
  "buildWebChildReminderCreatePayloadFromState",
  "relative_before_event"
]);
requireIncludes("apps/web/src/features/child-profiles/child-reminder-form-model.test.ts", [
  "00:00",
  "09:05",
  "23:59",
  "relative-before-event",
  "round-trips"
]);

if (failures.length > 0) {
  console.error("Web P0 feature completion boundary failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Web P0 feature completion boundary passed.");
