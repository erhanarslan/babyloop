"use client";

import type { ApiResponse } from "@babyloop/shared";

export type AssistantMode =
  | "find_products"
  | "sell_help"
  | "age_needs"
  | "safe_buying"
  | "platform_help";

export type AssistantChatRequest = {
  mode: AssistantMode;
  content: string;
};

export type AssistantChatTopic = {
  id: string;
  title: string;
  eyebrow: string;
  summary: string;
  stageLabel: string;
  commonMisconception: string;
  guidance: string;
  browseHref: string;
};

export type AssistantChatAction = {
  href: string;
  label: string;
};

export type AssistantChatReply = {
  mode: AssistantMode;
  content: string;
  topic?: AssistantChatTopic;
  actions: AssistantChatAction[];
  safetyDisclaimers: string[];
  providerName: string;
  promptVersion: string;
  confidenceScore: number;
};

export type AssistantChatPayload = {
  reply: AssistantChatReply;
};

export async function requestAssistantChat(
  apiBaseUrl: string,
  payload: AssistantChatRequest
): Promise<ApiResponse<AssistantChatPayload>> {
  try {
    const response = await fetch(`${apiBaseUrl}/api/v1/assistant/chat`, {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    return response.json() as Promise<ApiResponse<AssistantChatPayload>>;
  } catch {
    return {
      ok: false,
      error: {
        code: "API_UNAVAILABLE",
        message: "BabyLoop Assistant is unavailable."
      }
    };
  }
}
