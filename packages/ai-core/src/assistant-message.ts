import { mockAssistantMessageProvider } from "./mock-assistant-message-provider.js";
import type {
  AssistantMessageInput,
  AssistantMessageOutput,
  AssistantMessageProvider
} from "./types.js";

export async function answerAssistantMessage(
  input: AssistantMessageInput,
  provider: AssistantMessageProvider = mockAssistantMessageProvider
): Promise<AssistantMessageOutput> {
  return provider.answerMessage(input);
}
