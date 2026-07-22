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

export type GeminiPart =
  | { text: string }
  | {
      inlineData: {
        mimeType: string;
        data: string;
      };
    };

export type GeminiGenerateJsonOptions = {
  apiKey: string;
  endpoint?: string;
  fetch?: FetchLike;
  model: string;
  parts: GeminiPart[];
  responseSchema?: unknown;
  systemInstruction: string;
  temperature?: number;
};

export type GeminiEmbeddingOptions = {
  apiKey: string;
  endpoint?: string;
  fetch?: FetchLike;
  model: string;
  outputDimension: number;
  text: string;
};

const DEFAULT_GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com";

export async function generateGeminiJson(options: GeminiGenerateJsonOptions): Promise<unknown> {
  const apiKey = options.apiKey.trim();
  const model = normalizeGeminiModelName(options.model);

  if (!apiKey) {
    throw new Error("Gemini provider requires GEMINI_API_KEY.");
  }

  if (!model) {
    throw new Error("Gemini provider requires a model.");
  }

  const endpoint = (options.endpoint?.trim() || DEFAULT_GEMINI_ENDPOINT).replace(/\/$/, "");
  const fetchFn = options.fetch ?? getDefaultFetch();
  const response = await fetchFn(
    `${endpoint}/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: options.parts
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          ...(options.responseSchema ? { responseSchema: options.responseSchema } : {}),
          temperature: options.temperature ?? 0.2
        },
        systemInstruction: {
          parts: [
            {
              text: options.systemInstruction
            }
          ]
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini request failed with status ${response.status}.`);
  }

  const payload = await response.json();
  const text = extractGeminiText(payload);

  if (!text) {
    throw new Error("Gemini response did not include text output.");
  }

  return JSON.parse(stripJsonFence(text));
}

export function dataUrlToGeminiInlineData(dataUrl: string): GeminiPart | null {
  const match = /^data:([^;]+);base64,(.+)$/u.exec(dataUrl);

  if (!match?.[1] || !match[2]) {
    return null;
  }

  return {
    inlineData: {
      mimeType: match[1],
      data: match[2]
    }
  };
}

export async function generateGeminiEmbedding(options: GeminiEmbeddingOptions): Promise<number[]> {
  const apiKey = options.apiKey.trim();
  const model = normalizeGeminiModelName(options.model);
  const text = options.text.trim();
  const outputDimension = options.outputDimension;

  if (!apiKey) {
    throw new Error("Gemini embedding provider requires GEMINI_API_KEY.");
  }

  if (!model) {
    throw new Error("Gemini embedding provider requires a model.");
  }

  if (!text) {
    throw new Error("Gemini embedding provider requires non-empty text.");
  }

  if (!Number.isInteger(outputDimension) || outputDimension <= 0) {
    throw new Error("Gemini embedding output dimension must be a positive integer.");
  }

  const endpoint = (options.endpoint?.trim() || DEFAULT_GEMINI_ENDPOINT).replace(/\/$/, "");
  const fetchFn = options.fetch ?? getDefaultFetch();
  const response = await fetchFn(
    `${endpoint}/v1beta/models/${encodeURIComponent(model)}:embedContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        model: `models/${model}`,
        content: {
          parts: [{ text }]
        },
        output_dimensionality: outputDimension
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini embedding request failed with status ${response.status}.`);
  }

  const payload = await response.json();
  const values = extractGeminiEmbeddingValues(payload);

  if (values.length === 0) {
    throw new Error("Gemini embedding response did not include vector values.");
  }

  if (values.length !== outputDimension) {
    throw new Error(
      `Gemini embedding response dimension ${values.length} does not match requested dimension ${outputDimension}.`
    );
  }

  return values;
}

function normalizeGeminiModelName(value: string): string {
  return value.trim().replace(/^models\//u, "");
}

function getDefaultFetch(): FetchLike {
  const fetchFn = (globalThis as unknown as { fetch?: FetchLike }).fetch;

  if (!fetchFn) {
    throw new Error("Gemini provider requires global fetch support.");
  }

  return fetchFn;
}

function extractGeminiText(payload: unknown): string | undefined {
  if (typeof payload !== "object" || payload === null) {
    return undefined;
  }

  const candidates = (payload as { candidates?: unknown }).candidates;

  if (!Array.isArray(candidates)) {
    return undefined;
  }

  const textParts: string[] = [];

  for (const candidate of candidates) {
    if (typeof candidate !== "object" || candidate === null) {
      continue;
    }

    const content = (candidate as { content?: unknown }).content;

    if (typeof content !== "object" || content === null) {
      continue;
    }

    const parts = (content as { parts?: unknown }).parts;

    if (!Array.isArray(parts)) {
      continue;
    }

    for (const part of parts) {
      if (typeof part !== "object" || part === null) {
        continue;
      }

      const text = (part as { text?: unknown }).text;

      if (typeof text === "string") {
        textParts.push(text);
      }
    }
  }

  const joined = textParts.join("\n").trim();
  return joined.length > 0 ? joined : undefined;
}

function stripJsonFence(value: string): string {
  return value
    .trim()
    .replace(/^```json\s*/iu, "")
    .replace(/^```\s*/u, "")
    .replace(/\s*```$/u, "")
    .trim();
}

function extractGeminiEmbeddingValues(payload: unknown): number[] {
  if (typeof payload !== "object" || payload === null) {
    return [];
  }

  const embedding = (payload as { embedding?: unknown }).embedding;

  if (typeof embedding !== "object" || embedding === null) {
    return [];
  }

  const values = (embedding as { values?: unknown }).values;

  if (!Array.isArray(values)) {
    return [];
  }

  return values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}
