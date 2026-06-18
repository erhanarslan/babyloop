import { generateGeminiJson } from "./gemini-api.js";
import { ASSISTANT_MESSAGE_GEMINI_PROMPT_VERSION } from "./prompt-versions.js";
import type {
  AssistantMessageInput,
  AssistantMessageOutput,
  AssistantMessageProvider
} from "./types.js";

type FetchLike = Parameters<typeof generateGeminiJson>[0]["fetch"];

export type GeminiAssistantMessageProviderOptions = {
  apiKey: string;
  endpoint?: string;
  fetch?: FetchLike;
  model: string;
};

const GEMINI_PROVIDER_NAME = "gemini-generate-content";

export class GeminiAssistantMessageProvider implements AssistantMessageProvider {
  readonly providerName = GEMINI_PROVIDER_NAME;
  readonly modelName: string;

  private readonly apiKey: string;
  private readonly endpoint: string | undefined;
  private readonly fetchFn: FetchLike | undefined;

  constructor(options: GeminiAssistantMessageProviderOptions) {
    this.apiKey = options.apiKey.trim();
    this.modelName = options.model.trim();
    this.endpoint = options.endpoint?.trim() || undefined;
    this.fetchFn = options.fetch;

    if (!this.apiKey) {
      throw new Error("Gemini assistant provider requires GEMINI_API_KEY.");
    }

    if (!this.modelName) {
      throw new Error("Gemini assistant provider requires GEMINI_ASSISTANT_MODEL.");
    }
  }

  async answerMessage(input: AssistantMessageInput): Promise<AssistantMessageOutput> {
    const payload = await generateGeminiJson({
      apiKey: this.apiKey,
      ...(this.endpoint ? { endpoint: this.endpoint } : {}),
      ...(this.fetchFn ? { fetch: this.fetchFn } : {}),
      model: this.modelName,
      parts: [
        {
          text: JSON.stringify({
            locale: input.locale ?? "tr",
            message: input.message
          })
        }
      ],
      responseSchema: assistantMessageResponseSchema,
      systemInstruction: buildSystemPrompt(),
      temperature: 0.25
    });
    const parsed = normalizeAssistantOutput(payload);

    return {
      ...parsed,
      providerName: this.providerName,
      promptVersion: ASSISTANT_MESSAGE_GEMINI_PROMPT_VERSION,
      modelName: this.modelName
    };
  }
}

function buildSystemPrompt(): string {
  return [
    "Sen BabyLoop Asistan'sın. BabyLoop 0-7 yaş bebek/çocuk ürünlerine odaklı ikinci el, bağış ve takas marketplace ürünüdür.",
    "Kullanıcının gerçek sorusunu doğrudan yanıtla. Kullanıcı Türkçe yazarsa Türkçe yanıtla.",
    "Yanıt kısa, pratik, sakin ve ebeveyn dostu olsun.",
    "Tanı, ilaç, tedavi planı, terapi rehberliği veya beslenme reçetesi verme.",
    "Sağlık benzeri konularda yalnızca genel rahatlatma/güvenlik önerisi ver; belirti şiddetli, uzun süreli veya endişe vericiyse doktora danışılacağını kısa söyle.",
    "Telefon, e-posta, açık adres, token, şifre veya hassas çocuk bilgisi isteme ya da üretme.",
    "Sadece istenen JSON şemasına uygun yanıt ver."
  ].join(" ");
}

function normalizeAssistantOutput(
  payload: unknown
): Omit<AssistantMessageOutput, "providerName" | "promptVersion" | "modelName"> {
  if (typeof payload !== "object" || payload === null) {
    return fallbackOutput();
  }

  const record = payload as Record<string, unknown>;
  const answer = typeof record.answer === "string" ? record.answer.trim().slice(0, 2200) : "";
  const actions = Array.isArray(record.actions)
    ? record.actions
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .map((item) => ({
          label: typeof item.label === "string" ? item.label.trim().slice(0, 40) : "",
          href: typeof item.href === "string" ? item.href.trim().slice(0, 200) : ""
        }))
        .filter((item) => item.label.length > 0 && item.href.startsWith("/") && !item.href.startsWith("//"))
        .slice(0, 3)
    : [];

  return {
    answer: answer || fallbackOutput().answer,
    actions
  };
}

function fallbackOutput(): Omit<AssistantMessageOutput, "providerName" | "promptVersion" | "modelName"> {
  return {
    answer: "Asistan şu an kısa bir yanıt hazırlayamadı. Daha sonra tekrar deneyebilirsin.",
    actions: []
  };
}

const assistantMessageResponseSchema = {
  type: "object",
  properties: {
    answer: {
      type: "string"
    },
    actions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          href: { type: "string" }
        },
        required: ["label", "href"]
      }
    }
  },
  required: ["answer", "actions"]
} as const;
