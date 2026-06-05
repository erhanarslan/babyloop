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
  type RealtimeClientToServerEvents,
  type RealtimeConversationRoomPayload,
  type RealtimeConversationSummary,
  type RealtimeErrorCode,
  type RealtimeErrorPayload,
  type RealtimeEventName,
  type RealtimeMessage,
  type RealtimeServerToClientEvents
} from "./realtime.js";
