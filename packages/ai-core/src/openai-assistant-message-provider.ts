import { ASSISTANT_MESSAGE_OPENAI_PROMPT_VERSION } from "./prompt-versions.js";
import type {
  AssistantMessageInput,
  AssistantMessageOutput,
  AssistantMessageProvider
} from "./types.js";

type FetchLike = (
  url: string,
  init: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
  }
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

export type OpenAiAssistantMessageProviderOptions = {
  apiKey: string;
  model: string;
  endpoint?: string;
  fetch?: FetchLike;
};

const DEFAULT_OPENAI_RESPONSES_ENDPOINT = "https://api.openai.com/v1/responses";
const OPENAI_PROVIDER_NAME = "openai-responses";

export class OpenAiAssistantMessageProvider implements AssistantMessageProvider {
  readonly providerName = OPENAI_PROVIDER_NAME;
  readonly modelName: string;

  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly fetchFn: FetchLike;

  constructor(options: OpenAiAssistantMessageProviderOptions) {
    const apiKey = options.apiKey.trim();
    const model = options.model.trim();

    if (!apiKey) {
      throw new Error("OpenAI assistant provider requires OPENAI_API_KEY.");
    }

    if (!model) {
      throw new Error("OpenAI assistant provider requires OPENAI_ASSISTANT_MODEL.");
    }

    this.apiKey = apiKey;
    this.modelName = model;
    this.endpoint = options.endpoint?.trim() || DEFAULT_OPENAI_RESPONSES_ENDPOINT;
    this.fetchFn = options.fetch ?? getDefaultFetch();
  }

  async answerMessage(input: AssistantMessageInput): Promise<AssistantMessageOutput> {
    const response = await this.fetchFn(this.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.modelName,
        store: false,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: buildSystemPrompt()
              }
            ]
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: JSON.stringify({
                  locale: input.locale ?? "tr",
                  message: input.message
                })
              }
            ]
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "babyloop_assistant_message",
            strict: true,
            schema: assistantMessageJsonSchema
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI assistant request failed with status ${response.status}.`);
    }

    const payload = await response.json();
    const parsed = parseOpenAiStructuredOutput(payload);

    return {
      ...parsed,
      providerName: this.providerName,
      promptVersion: ASSISTANT_MESSAGE_OPENAI_PROMPT_VERSION,
      modelName: this.modelName
    };
  }
}

function getDefaultFetch(): FetchLike {
  const fetchFn = (globalThis as unknown as { fetch?: FetchLike }).fetch;

  if (!fetchFn) {
    throw new Error("OpenAI assistant provider requires global fetch support.");
  }

  return fetchFn;
}

function buildSystemPrompt(): string {
  return [
    "You are BabyLoop Asistan, a concise Turkish-first assistant for a baby and child focused second-hand marketplace.",
    "Answer the user's actual question directly. If the user asks in Turkish, answer in Turkish.",
    "Keep answers short, practical, calm, and parent-friendly.",
    "Do not provide diagnosis, medication, treatment plans, therapy guidance, or diet prescriptions.",
    "For health-like topics, give simple general comfort guidance and include a short line to consult a doctor when symptoms are severe, prolonged, or concerning.",
    "Do not ask for or expose phone numbers, email addresses, addresses, tokens, credentials, or sensitive child details.",
    "Return JSON only."
  ].join(" ");
}

function parseOpenAiStructuredOutput(
  payload: unknown
): Omit<AssistantMessageOutput, "providerName" | "promptVersion" | "modelName"> {
  const text = extractOutputText(payload);

  if (!text) {
    throw new Error("OpenAI assistant response did not include text output.");
  }

  const parsed = JSON.parse(text) as Record<string, unknown>;
  const answer = typeof parsed.answer === "string" ? parsed.answer.trim() : "";
  const actions = Array.isArray(parsed.actions)
    ? parsed.actions
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .map((item) => ({
          label: typeof item.label === "string" ? item.label.trim() : "",
          href: typeof item.href === "string" ? item.href.trim() : ""
        }))
        .filter((item) => item.label.length > 0 && isSafeInternalHref(item.href))
        .slice(0, 3)
    : [];

  return {
    answer: answer || "Asistan şu an kısa bir yanıt hazırlayamadı. Daha sonra tekrar deneyebilirsin.",
    actions
  };
}

function extractOutputText(payload: unknown): string | undefined {
  if (typeof payload !== "object" || payload === null) {
    return undefined;
  }

  const outputText = (payload as { output_text?: unknown }).output_text;

  if (typeof outputText === "string") {
    return outputText;
  }

  const output = (payload as { output?: unknown }).output;

  if (!Array.isArray(output)) {
    return undefined;
  }

  for (const item of output) {
    if (typeof item !== "object" || item === null) {
      continue;
    }

    const content = (item as { content?: unknown }).content;

    if (!Array.isArray(content)) {
      continue;
    }

    for (const contentItem of content) {
      if (typeof contentItem !== "object" || contentItem === null) {
        continue;
      }

      const text = (contentItem as { text?: unknown }).text;

      if (typeof text === "string") {
        return text;
      }
    }
  }

  return undefined;
}

function isSafeInternalHref(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//");
}

const assistantMessageJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "actions"],
  properties: {
    answer: {
      type: "string",
      minLength: 1,
      maxLength: 2200
    },
    actions: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "href"],
        properties: {
          label: { type: "string", maxLength: 40 },
          href: { type: "string", maxLength: 200 }
        }
      }
    }
  }
} as const;
