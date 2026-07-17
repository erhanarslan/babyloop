export const analyticsPlatformValues = ["web", "mobile"] as const;
export type AnalyticsPlatform = (typeof analyticsPlatformValues)[number];

export const analyticsEventNameValues = [
  "session_started",
  "session_ended",
  "page_viewed",
  "screen_viewed",
  "engagement_heartbeat",
  "app_backgrounded",
  "app_foregrounded",
  "registration_started",
  "registration_completed",
  "login_started",
  "login_completed",
  "login_failed",
  "logout_completed",
  "email_verification_completed",
  "mfa_challenge_started",
  "mfa_completed",
  "login_approval_started",
  "login_approval_completed",
  "browse_viewed",
  "search_submitted",
  "category_viewed",
  "listing_impression",
  "listing_opened",
  "listing_shared",
  "listing_favorited",
  "listing_unfavorited",
  "seller_profile_opened",
  "saved_search_created",
  "sell_flow_started",
  "sell_step_viewed",
  "sell_image_added",
  "ai_listing_draft_requested",
  "ai_listing_draft_generated",
  "ai_listing_draft_applied",
  "listing_created",
  "listing_updated",
  "listing_status_changed",
  "conversation_list_viewed",
  "conversation_opened",
  "conversation_started",
  "message_sent",
  "message_marked_read",
  "seller_contact_clicked",
  "cart_viewed",
  "cart_item_added",
  "cart_item_removed",
  "checkout_started",
  "checkout_completed",
  "checkout_failed",
  "assistant_opened",
  "assistant_question_submitted",
  "assistant_answer_received",
  "assistant_suggested_action_clicked",
  "child_profile_created",
  "child_profile_opened",
  "child_note_created",
  "child_reminder_created",
  "child_reminder_updated",
  "child_reminder_deleted",
  "notification_preferences_updated"
] as const;

export type AnalyticsEventName = (typeof analyticsEventNameValues)[number];

export type AnalyticsProperty = string | number | boolean | null;

export type AnalyticsEventEnvelope = {
  eventId: string;
  eventName: AnalyticsEventName;
  eventVersion: number;
  occurredAt: string;
  platform: AnalyticsPlatform;
  sessionId: string;
  anonymousId: string;
  pagePath?: string;
  screenName?: string;
  appVersion?: string;
  properties?: Record<string, AnalyticsProperty>;
};

export const analyticsSensitivePropertyKeys = [
  "password",
  "accessToken",
  "refreshToken",
  "approvalToken",
  "mfaChallengeToken",
  "csrfToken",
  "cookie",
  "authorization",
  "emailBody",
  "messageBody",
  "body",
  "childNoteBody",
  "assistantPrompt",
  "prompt",
  "rawSourceText",
  "imageBase64",
  "signedUrl",
  "ip",
  "userId"
] as const;

export const analyticsEventPropertyAllowlist: Record<AnalyticsEventName, readonly string[]> = {
  session_started: ["entrySurface"],
  session_ended: ["exitSurface", "engagementMs"],
  page_viewed: ["routeTemplate", "pageGroup", "referrerGroup"],
  screen_viewed: ["screenName", "sourceSurface"],
  engagement_heartbeat: ["routeTemplate", "screenName", "engagementMs"],
  app_backgrounded: ["screenName"],
  app_foregrounded: ["screenName"],
  registration_started: ["authProvider", "sourceSurface"],
  registration_completed: ["authProvider", "newSession"],
  login_started: ["authProvider", "sourceSurface"],
  login_completed: ["authProvider", "mfaUsed", "mobileApprovalUsed", "newSession"],
  login_failed: ["authProvider", "reasonBucket"],
  logout_completed: ["sourceSurface"],
  email_verification_completed: ["authProvider"],
  mfa_challenge_started: ["authProvider"],
  mfa_completed: ["authProvider"],
  login_approval_started: ["authProvider"],
  login_approval_completed: ["authProvider", "decision"],
  browse_viewed: ["sourceSurface"],
  search_submitted: ["queryLengthBucket", "resultCountBucket", "categoryId", "sourceSurface"],
  category_viewed: ["categoryId", "sourceSurface"],
  listing_impression: ["listingId", "categoryId", "listingType", "listingStatus", "sourceSurface"],
  listing_opened: ["listingId", "categoryId", "listingType", "listingStatus", "sourceSurface"],
  listing_shared: ["listingId", "sourceSurface"],
  listing_favorited: ["listingId", "categoryId", "sourceSurface"],
  listing_unfavorited: ["listingId", "categoryId", "sourceSurface"],
  seller_profile_opened: ["sellerProfileId", "listingId", "sourceSurface"],
  saved_search_created: ["savedSearchId", "categoryId", "sourceSurface"],
  sell_flow_started: ["sourceSurface"],
  sell_step_viewed: ["step"],
  sell_image_added: ["imageCountBucket"],
  ai_listing_draft_requested: ["imageCountBucket", "hasTextHints"],
  ai_listing_draft_generated: ["imageCountBucket", "confidenceBucket", "warningCount"],
  ai_listing_draft_applied: ["appliedFieldCount"],
  listing_created: ["listingId", "categoryId", "listingType", "listingStatus"],
  listing_updated: ["listingId", "categoryId", "listingStatus"],
  listing_status_changed: ["listingId", "categoryId", "previousStatus", "listingStatus"],
  conversation_list_viewed: ["sourceSurface"],
  conversation_opened: ["conversationId", "listingId", "sourceSurface"],
  conversation_started: ["conversationId", "listingId", "sourceSurface"],
  message_sent: ["conversationId", "listingId", "sourceSurface", "bodyLengthBucket", "moderationOutcome"],
  message_marked_read: ["conversationId"],
  seller_contact_clicked: ["listingId", "sourceSurface"],
  cart_viewed: ["itemCountBucket"],
  cart_item_added: ["listingId", "categoryId", "sourceSurface"],
  cart_item_removed: ["listingId", "categoryId", "sourceSurface"],
  checkout_started: ["itemCountBucket", "cartValueBucket"],
  checkout_completed: ["itemCountBucket", "cartValueBucket", "providerMode"],
  checkout_failed: ["itemCountBucket", "reasonBucket", "providerMode"],
  assistant_opened: ["sourceSurface"],
  assistant_question_submitted: ["domain", "sourceSurface"],
  assistant_answer_received: ["domain", "mode", "grounded", "groundingStatus", "sourceCount", "toolsUsed", "latencyBucket"],
  assistant_suggested_action_clicked: ["actionType", "domain", "sourceSurface"],
  child_profile_created: ["ageBand"],
  child_profile_opened: ["ageBand", "sourceSurface"],
  child_note_created: ["noteCategory"],
  child_reminder_created: ["scheduleKind", "reminderCategory", "hasPreNotification"],
  child_reminder_updated: ["scheduleKind", "reminderCategory", "active"],
  child_reminder_deleted: ["scheduleKind", "reminderCategory"],
  notification_preferences_updated: ["channel", "enabled", "digest"]
};

export function getAllowedAnalyticsProperties(eventName: AnalyticsEventName): readonly string[] {
  return analyticsEventPropertyAllowlist[eventName] ?? [];
}
