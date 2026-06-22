"use client";

export type AssistantSuggestedAction = {
  type: string;
  label: string;
  href?: string;
  payload?: Record<string, unknown>;
};

export type AssistantToolResultPreview = {
  tool: string;
  title: string;
  summary: string;
};

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

export type AssistantMessageAction = {
  href: string;
  label: string;
};

export type AssistantMessageSource = {
  title: string;
  sourcePath: string;
  section?: string;
  topic?: string;
};

export type AssistantMessagePayload = {
  answer: string;
  actions?: AssistantMessageAction[];
  sources?: AssistantMessageSource[];
  mode?: "rag" | "boundary" | "no_sources";
  grounded?: boolean;
  intent?: string;
  toolsUsed?: string[];
  toolResultsPreview?: AssistantToolResultPreview[];
  suggestedActions?: AssistantSuggestedAction[];
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
        message: "Asistan şu an yapılandırılmadı. Daha sonra tekrar deneyebilirsin."
      }
    };
  }
}

export async function requestAssistantMessage(
  apiBaseUrl: string,
  payload: {
    message: string;
    locale?: "tr" | "en";
  }
): Promise<ApiResponse<AssistantMessagePayload>> {
  try {
    const response = await fetch(`${apiBaseUrl}/api/v1/assistant/messages`, {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    return response.json() as Promise<ApiResponse<AssistantMessagePayload>>;
  } catch {
    return {
      ok: false,
      error: {
        code: "API_UNAVAILABLE",
        message: "Asistan şu an yapılandırılmadı. Daha sonra tekrar deneyebilirsin."
      }
    };
  }
}
