import { apiRequest } from "../../api/client";

export type MobileAssistantSource = {
  title: string;
  sourcePath?: string;
  section?: string;
  topic?: string;
};

export type MobileAssistantAnswer = {
  answer: string;
  mode: "rag" | "boundary" | "no_sources" | "provider";
  grounded: boolean;
  sources: MobileAssistantSource[];
};

type AssistantMessageResponse = {
  answer: string;
  mode?: "rag" | "boundary" | "no_sources";
  grounded?: boolean;
  sources?: MobileAssistantSource[];
};

export async function askMobileAssistant(message: string): Promise<MobileAssistantAnswer> {
  const result = await apiRequest<AssistantMessageResponse>("/api/v1/assistant/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      locale: "tr",
      message
    })
  });

  if (!result.ok) {
    throw new Error(result.error);
  }

  return {
    answer: result.data.answer,
    mode: result.data.mode ?? "provider",
    grounded: result.data.grounded ?? false,
    sources: result.data.sources ?? []
  };
}
