"use client";

import type { ApiResponse } from "@babyloop/shared";
import { authHeader } from "../../lib/auth-client";

export type ConversationSummary = {
  id: string;
  otherProfile: {
    id: string;
    displayName: string;
  };
  contextListing: {
    id: string;
    title: string;
  } | null;
  latestMessage: {
    body: string;
    senderProfileId: string;
    createdAt: string;
  } | null;
  status: string;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Message = {
  id: string;
  conversationId: string;
  sender: {
    id: string;
    displayName: string;
  };
  body: string;
  createdAt: string;
  deletedAt: string | null;
};

type ConversationPayload = {
  conversation: ConversationSummary;
};

type ConversationsPayload = {
  conversations: ConversationSummary[];
};

type MessagesPayload = {
  messages: Message[];
};

type SendMessagePayload = {
  message: Message;
};

export async function createOrGetConversation(
  apiBaseUrl: string,
  listingId: string
): Promise<ApiResponse<ConversationPayload>> {
  const response = await fetch(`${apiBaseUrl}/api/v1/conversations`, {
    method: "POST",
    headers: {
      ...authHeader(),
      "content-type": "application/json"
    },
    body: JSON.stringify({ listingId })
  });

  return response.json() as Promise<ApiResponse<ConversationPayload>>;
}

export async function fetchConversations(
  apiBaseUrl: string
): Promise<ApiResponse<ConversationsPayload>> {
  const response = await fetch(`${apiBaseUrl}/api/v1/conversations`, {
    headers: authHeader()
  });

  return response.json() as Promise<ApiResponse<ConversationsPayload>>;
}

export async function fetchConversation(
  apiBaseUrl: string,
  conversationId: string
): Promise<ApiResponse<ConversationPayload>> {
  const response = await fetch(`${apiBaseUrl}/api/v1/conversations/${conversationId}`, {
    headers: authHeader()
  });

  return response.json() as Promise<ApiResponse<ConversationPayload>>;
}

export async function fetchMessages(
  apiBaseUrl: string,
  conversationId: string
): Promise<ApiResponse<MessagesPayload>> {
  const response = await fetch(`${apiBaseUrl}/api/v1/conversations/${conversationId}/messages`, {
    headers: authHeader()
  });

  return response.json() as Promise<ApiResponse<MessagesPayload>>;
}

export async function sendMessage(
  apiBaseUrl: string,
  conversationId: string,
  body: string
): Promise<ApiResponse<SendMessagePayload>> {
  const response = await fetch(`${apiBaseUrl}/api/v1/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: {
      ...authHeader(),
      "content-type": "application/json"
    },
    body: JSON.stringify({ body })
  });

  return response.json() as Promise<ApiResponse<SendMessagePayload>>;
}
