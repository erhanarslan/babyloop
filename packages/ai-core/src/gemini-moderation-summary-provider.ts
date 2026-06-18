import { generateGeminiJson } from "./gemini-api.js";
import { MODERATION_SUMMARY_GEMINI_PROMPT_VERSION } from "./prompt-versions.js";
import type {
  ModerationSummaryInput,
  ModerationSummaryOutput,
  ModerationSummaryProvider
} from "./types.js";

type FetchLike = Parameters<typeof generateGeminiJson>[0]["fetch"];

export type GeminiModerationSummaryProviderOptions = {
  apiKey: string;
  endpoint?: string;
  fetch?: FetchLike;
  model: string;
};

const GEMINI_PROVIDER_NAME = "gemini-generate-content";

export class GeminiModerationSummaryProvider implements ModerationSummaryProvider {
  readonly providerName = GEMINI_PROVIDER_NAME;
  readonly modelName: string;

  private readonly apiKey: string;
  private readonly endpoint: string | undefined;
  private readonly fetchFn: FetchLike | undefined;

  constructor(options: GeminiModerationSummaryProviderOptions) {
    this.apiKey = options.apiKey.trim();
    this.modelName = options.model.trim();
    this.endpoint = options.endpoint?.trim() || undefined;
    this.fetchFn = options.fetch;

    if (!this.apiKey) {
      throw new Error("Gemini moderation summary provider requires GEMINI_API_KEY.");
    }

    if (!this.modelName) {
      throw new Error("Gemini moderation summary provider requires GEMINI_MODERATION_SUMMARY_MODEL.");
    }
  }

  async summarizeModerationCase(input: ModerationSummaryInput): Promise<ModerationSummaryOutput> {
    const payload = await generateGeminiJson({
      apiKey: this.apiKey,
      ...(this.endpoint ? { endpoint: this.endpoint } : {}),
      ...(this.fetchFn ? { fetch: this.fetchFn } : {}),
      model: this.modelName,
      parts: [
        {
          text: JSON.stringify(input)
        }
      ],
      responseSchema: moderationSummaryResponseSchema,
      systemInstruction: buildSystemPrompt(),
      temperature: 0.1
    });
    const parsed = normalizeModerationSummaryOutput(payload);

    return {
      ...parsed,
      providerName: this.providerName,
      promptVersion: MODERATION_SUMMARY_GEMINI_PROMPT_VERSION,
      modelName: this.modelName
    };
  }
}

function buildSystemPrompt(): string {
  return [
    "You are BabyLoop's Trust & Safety moderation triage assistant.",
    "Use only the redacted JSON context supplied by the user message.",
    "Do not infer or invent identities, contact details, raw message bodies, private account data, tokens, or reporter identity.",
    "Return a concise JSON object matching the schema.",
    "The output is advisory only; a human moderator makes final enforcement decisions."
  ].join(" ");
}

function normalizeModerationSummaryOutput(
  payload: unknown
): Omit<ModerationSummaryOutput, "providerName" | "promptVersion" | "modelName"> {
  if (typeof payload !== "object" || payload === null) {
    return fallbackOutput();
  }

  const record = payload as Record<string, unknown>;
  const summary = typeof record.summary === "string" ? record.summary.trim().slice(0, 1000) : "";
  const riskLevel = isRiskLevel(record.riskLevel) ? record.riskLevel : "medium";
  const recommendedAction = isRecommendedAction(record.recommendedAction)
    ? record.recommendedAction
    : "continue_review";
  const rationale = stringArray(record.rationale, 8, 240);
  const safetySignals = stringArray(record.safetySignals, 12, 240);
  const confidenceScore = typeof record.confidenceScore === "number"
    ? Math.min(Math.max(Math.round(record.confidenceScore * 100) / 100, 0), 1)
    : 0.5;

  return {
    summary: summary || fallbackOutput().summary,
    riskLevel,
    recommendedAction,
    rationale,
    safetySignals,
    confidenceScore
  };
}

function fallbackOutput(): Omit<ModerationSummaryOutput, "providerName" | "promptVersion" | "modelName"> {
  return {
    summary: "Moderation summary unavailable. Continue human review using the redacted case timeline.",
    riskLevel: "medium",
    recommendedAction: "continue_review",
    rationale: [],
    safetySignals: [],
    confidenceScore: 0.5
  };
}

function stringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().slice(0, maxLength))
        .filter(Boolean)
        .slice(0, maxItems)
    : [];
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

const moderationSummaryResponseSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    riskLevel: { type: "string" },
    recommendedAction: { type: "string" },
    rationale: {
      type: "array",
      items: { type: "string" }
    },
    safetySignals: {
      type: "array",
      items: { type: "string" }
    },
    confidenceScore: { type: "number" }
  },
  required: ["summary", "riskLevel", "recommendedAction", "rationale", "safetySignals", "confidenceScore"]
} as const;
