import { generateGeminiEmbedding } from "./gemini-api.js";
import { RAG_EMBEDDING_GEMINI_PROMPT_VERSION } from "./prompt-versions.js";
import type {
  EmbeddingInput,
  EmbeddingOutput,
  EmbeddingProvider
} from "./types.js";

type FetchLike = Parameters<typeof generateGeminiEmbedding>[0]["fetch"];

export type GeminiEmbeddingProviderOptions = {
  apiKey: string;
  endpoint?: string;
  fetch?: FetchLike;
  model: string;
  outputDimension?: number;
};

const DEFAULT_OUTPUT_DIMENSION = 3072;

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  readonly providerName = "gemini-embedding";
  readonly modelName: string;

  private readonly apiKey: string;
  private readonly endpoint?: string;
  private readonly fetch?: FetchLike;
  private readonly outputDimension: number;

  constructor(options: GeminiEmbeddingProviderOptions) {
    this.apiKey = options.apiKey.trim();
    this.modelName = options.model.trim().replace(/^models\//u, "");
    this.outputDimension = options.outputDimension ?? DEFAULT_OUTPUT_DIMENSION;

    if (!this.apiKey) {
      throw new Error("Gemini embedding provider requires GEMINI_API_KEY.");
    }

    if (!this.modelName) {
      throw new Error("Gemini embedding provider requires a model.");
    }

    if (!Number.isInteger(this.outputDimension) || this.outputDimension <= 0) {
      throw new Error("Gemini embedding output dimension must be a positive integer.");
    }

    if (options.endpoint) {
      this.endpoint = options.endpoint;
    }

    if (options.fetch) {
      this.fetch = options.fetch;
    }
  }

  async embedText(input: EmbeddingInput): Promise<EmbeddingOutput> {
    const text = formatGeminiEmbeddingInput(input);

    const embedding = await generateGeminiEmbedding({
      apiKey: this.apiKey,
      model: this.modelName,
      outputDimension: this.outputDimension,
      text,
      ...(this.endpoint ? { endpoint: this.endpoint } : {}),
      ...(this.fetch ? { fetch: this.fetch } : {})
    });

    return {
      embedding,
      providerName: this.providerName,
      promptVersion: RAG_EMBEDDING_GEMINI_PROMPT_VERSION,
      modelName: this.modelName
    };
  }
}

export function formatGeminiEmbeddingInput(input: EmbeddingInput): string {
  const text = normalizeEmbeddingText(input.text);

  if (!text) {
    throw new Error("Embedding text cannot be empty.");
  }

  if (input.purpose === "query") {
    return `task: search result | query: ${text}`;
  }

  const title = normalizeDocumentTitle(input.title);
  return `title: ${title} | text: ${text}`;
}

function normalizeEmbeddingText(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function normalizeDocumentTitle(value: string | undefined): string {
  const normalized = (value ?? "")
    .replace(/\|/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

  return normalized || "none";
}
