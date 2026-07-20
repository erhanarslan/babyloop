export type ApiSuccess<TData> = {
  ok: true;
  data: TData;
};

export type ApiFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

export type ApiResponse<TData> = ApiSuccess<TData> | ApiFailure;

export {
  moderateMessageBody,
  type MessageModerationReason,
  type MessageModerationResult
} from "./message-moderation.js";

export {
  REALTIME_EVENTS,
  realtimeConversationRoom,
  realtimeProfileRoom,
  type ConversationUpdatedPayload,
  type MessageCreatedPayload,
  type NotificationCreatedPayload,
  type NotificationReadAllPayload,
  type NotificationReadPayload,
  type NotificationUnreadCountUpdatedPayload,
  type RealtimeClientToServerEvents,
  type RealtimeConversationRoomPayload,
  type RealtimeConversationSummary,
  type RealtimeErrorCode,
  type RealtimeErrorPayload,
  type RealtimeEventName,
  type RealtimeMessage,
  type RealtimeNotification,
  type RealtimeNotificationActorProfile,
  type RealtimeNotificationType,
  type RealtimeServerToClientEvents
} from "./realtime.js";
export type { LoginApprovalCreatedPayload, RealtimeLoginApprovalChallenge } from "./realtime.js";

export {
  analyticsEventNameValues,
  analyticsEventPropertyAllowlist,
  analyticsPlatformValues,
  analyticsSensitivePropertyKeys,
  getAllowedAnalyticsProperties,
  type AnalyticsEventEnvelope,
  type AnalyticsEventName,
  type AnalyticsPlatform,
  type AnalyticsProperty
} from "./analytics-events.js";

export {
  CURRENT_TERMS_VERSION,
  LEGAL_ACCEPTANCE_DOCUMENT_TYPES,
  LEGAL_ACCEPTANCE_SOURCES,
  LEGAL_DOCUMENT_VERSIONS,
  type LegalAcceptanceDocumentType,
  type LegalAcceptanceSource,
  type LegalDocumentKey
} from "./legal.js";
