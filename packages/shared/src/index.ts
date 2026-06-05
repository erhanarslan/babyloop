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
