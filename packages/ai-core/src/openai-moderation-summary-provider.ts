import { MODERATION_SUMMARY_OPENAI_PROMPT_VERSION } from "./prompt-versions.js";
import type {
  ModerationSummaryInput,
  ModerationSummaryOutput,
  ModerationSummaryProvider
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

export type OpenAiModerationSummaryProviderOptions = {
  apiKey: string;
  model: string;
  endpoint?: string;
  fetch?: FetchLike;
};

const DEFAULT_OPENAI_RESPONSES_ENDPOINT = "https://api.openai.com/v1/responses";
const OPENAI_PROVIDER_NAME = "openai-responses";

export class OpenAiModerationSummaryProvider implements ModerationSummaryProvider {
  readonly providerName = OPENAI_PROVIDER_NAME;
  readonly modelName: string;

  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly fetchFn: FetchLike;

  constructor(options: OpenAiModerationSummaryProviderOptions) {
    const apiKey = options.apiKey.trim();
    const model = options.model.trim();

    if (!apiKey) {
      throw new Error("OpenAI moderation summary provider requires OPENAI_API_KEY.");
    }

    if (!model) {
      throw new Error("OpenAI moderation summary provider requires OPENAI_MODERATION_SUMMARY_MODEL.");
    }

    this.apiKey = apiKey;
    this.modelName = model;
    this.endpoint = options.endpoint?.trim() || DEFAULT_OPENAI_RESPONSES_ENDPOINT;
    this.fetchFn = options.fetch ?? getDefaultFetch();
  }

  async summarizeModerationCase(
    input: ModerationSummaryInput
  ): Promise<ModerationSummaryOutput> {
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
                text: JSON.stringify(input)
              }
            ]
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "babyloop_moderation_summary",
            strict: true,
            schema: moderationSummaryJsonSchema
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI moderation summary request failed with status ${response.status}.`);
    }

    const payload = await response.json();
    const parsed = parseOpenAiStructuredOutput(payload);

    return {
      ...parsed,
      providerName: this.providerName,
      promptVersion: MODERATION_SUMMARY_OPENAI_PROMPT_VERSION,
      modelName: this.modelName
    };
  }
}

function getDefaultFetch(): FetchLike {
  const fetchFn = (globalThis as unknown as { fetch?: FetchLike }).fetch;

  if (!fetchFn) {
    throw new Error("OpenAI moderation summary provider requires global fetch support.");
  }

  return fetchFn;
}

function buildSystemPrompt(): string {
  return [
    "You are BabyLoop's Trust & Safety moderation triage assistant.",
    "Use only the redacted JSON context supplied by the user message.",
    "Do not infer or invent identities, contact details, raw message bodies, or private account data.",
    "Return a concise JSON object that matches the provided schema.",
    "The output is advisory only; a human moderator makes final enforcement decisions."
  ].join(" ");
}

function parseOpenAiStructuredOutput(payload: unknown): Omit<ModerationSummaryOutput, "providerName" | "promptVersion" | "modelName"> {
  const text = extractOutputText(payload);

  if (!text) {
    throw new Error("OpenAI moderation summary response did not include text output.");
  }

  const parsed = JSON.parse(text) as Partial<ModerationSummaryOutput>;

  return {
    summary: typeof parsed.summary === "string" ? parsed.summary : "Moderation summary unavailable.",
    riskLevel: isRiskLevel(parsed.riskLevel) ? parsed.riskLevel : "medium",
    recommendedAction: isRecommendedAction(parsed.recommendedAction)
      ? parsed.recommendedAction
      : "continue_review",
    rationale: Array.isArray(parsed.rationale)
      ? parsed.rationale.filter((item): item is string => typeof item === "string")
      : [],
    safetySignals: Array.isArray(parsed.safetySignals)
      ? parsed.safetySignals.filter((item): item is string => typeof item === "string")
      : [],
    confidenceScore: typeof parsed.confidenceScore === "number" ? parsed.confidenceScore : 0.5
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

function isRiskLevel(value: unknown): value is ModerationSummaryOutput["riskLevel"] {
  return value === "low" || value === "medium" || value === "high";
}

function isRecommendedAction(value: unknown): value is ModerationSummaryOutput["recommendedAction"] {
  return (
    value === "dismiss_or_monitor" ||
    value === "continue_review" ||
    value === "hide_listing" ||
    value === "hide_message" ||
    value === "restrict_profile" ||
    value === "escalate"
  );
}

const moderationSummaryJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "riskLevel",
    "recommendedAction",
    "rationale",
    "safetySignals",
    "confidenceScore"
  ],
  properties: {
    summary: { type: "string", maxLength: 1000 },
    riskLevel: { type: "string", enum: ["low", "medium", "high"] },
    recommendedAction: {
      type: "string",
      enum: [
        "dismiss_or_monitor",
        "continue_review",
        "hide_listing",
        "hide_message",
        "restrict_profile",
        "escalate"
      ]
    },
    rationale: {
      type: "array",
      maxItems: 8,
      items: { type: "string", maxLength: 240 }
    },
    safetySignals: {
      type: "array",
      maxItems: 12,
      items: { type: "string", maxLength: 120 }
    },
    confidenceScore: { type: "number", minimum: 0, maximum: 1 }
  }
} as const;
