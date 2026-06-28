"use client";

import type { ConversationSummary } from "./api";

export const CONVERSATION_READ_STATE_UPDATED_EVENT =
  "babyloop-conversation-read-state-updated";

export type ConversationReadStateUpdatedDetail = {
  conversation: ConversationSummary;
  unreadConversationCount: number;
  unreadNotificationCount: number;
};

export function dispatchConversationReadStateUpdated(
  detail: ConversationReadStateUpdatedDetail,
): void {
  window.dispatchEvent(
    new CustomEvent<ConversationReadStateUpdatedDetail>(
      CONVERSATION_READ_STATE_UPDATED_EVENT,
      {
        detail,
      },
    ),
  );
}
