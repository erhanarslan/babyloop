import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function mustContain(path, value) {
  const source = read(path);
  if (!source.includes(value)) {
    throw new Error(`${path} must contain ${JSON.stringify(value)}`);
  }
}

function mustNotContain(path, value) {
  const source = read(path);
  if (source.includes(value)) {
    throw new Error(`${path} must not contain ${JSON.stringify(value)}`);
  }
}

const securityPath = "apps/mobile/app/(tabs)/security.tsx";
const myListingsPath = "apps/mobile/src/features/listings/my-listings-screen.tsx";
const analyticsProviderPath = "apps/mobile/src/features/analytics/analytics-provider.tsx";
const analyticsClientPath = "apps/mobile/src/features/analytics/analytics-client.ts";
const authApiPath = "apps/mobile/src/features/auth/auth-api.ts";
const authSessionPath = "apps/mobile/src/features/auth/auth-session.tsx";
const tabLayoutPath = "apps/mobile/app/(tabs)/_layout.tsx";
const messagesScreenPath = "apps/mobile/src/features/messages/messages-screen.tsx";
const conversationStorePath = "apps/mobile/src/features/messages/conversation-list-store.tsx";
const pushBootstrapPath = "apps/mobile/src/features/notifications/mobile-push-registration-bootstrap.tsx";

mustContain(securityPath, "useFocusEffect");
mustContain(securityPath, "AppState.addEventListener");
mustNotContain(securityPath, "setInterval(");

mustContain(myListingsPath, "shouldPollMobilePendingPublication");
mustContain(myListingsPath, "getMobilePendingPublicationPollDelay");
mustNotContain(myListingsPath, "setInterval(");

mustContain(analyticsProviderPath, "MOBILE_ANALYTICS_FLUSH_THRESHOLD");
mustContain(analyticsProviderPath, "MOBILE_ANALYTICS_FLUSH_DELAY_MS");
mustContain(analyticsProviderPath, "scheduleFlush");
mustNotContain(analyticsProviderPath, "trackAndFlush");
mustContain(analyticsClientPath, "enqueueOperation");
mustContain(analyticsClientPath, "while (true)");

mustContain(authApiPath, "mobileSessionRefreshPromise");
mustContain(authApiPath, "performMobileSessionRefresh");
mustContain(authSessionPath, "setCurrentUser(payload)");
mustNotContain(authSessionPath, "const me = await fetchMobileCurrentUser();");

mustContain(tabLayoutPath, "useMobileConversationList");
mustNotContain(tabLayoutPath, "fetchMobileConversations");
mustNotContain(tabLayoutPath, "subscribeMobileRealtime");
mustContain(messagesScreenPath, "useMobileConversationList");
mustNotContain(messagesScreenPath, "fetchMobileConversations");
mustNotContain(messagesScreenPath, "subscribeMobileRealtime");
mustContain(conversationStorePath, "fetchMobileConversations");
mustContain(conversationStorePath, "subscribeMobileRealtime");
mustContain(conversationStorePath, "inFlightRef");

mustContain(pushBootstrapPath, "getMobilePushRegistrationRetryDelay");
mustContain(pushBootstrapPath, "getMobilePushRegistrationCache");
mustContain(pushBootstrapPath, "MOBILE_PUSH_REGISTRATION_MAX_ATTEMPTS");
mustNotContain(pushBootstrapPath, "const RETRY_DELAY_MS = 5000");
mustNotContain(pushBootstrapPath, "const MAX_ATTEMPTS = 24");

console.log("Mobile runtime network/performance boundary passed.");
