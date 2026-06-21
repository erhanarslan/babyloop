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
};

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  readonly providerName = "gemini-embedding";
  readonly modelName: string;

  private readonly apiKey: string;
  private readonly endpoint?: string;
  private readonly fetch?: FetchLike;

  constructor(options: GeminiEmbeddingProviderOptions) {
    this.apiKey = options.apiKey;
    this.modelName = options.model;

    if (options.endpoint) {
      this.endpoint = options.endpoint;
    }

    if (options.fetch) {
      this.fetch = options.fetch;
    }
  }

  async embedText(input: EmbeddingInput): Promise<EmbeddingOutput> {
    const text = input.text.trim();

    if (!text) {
      throw new Error("Embedding text cannot be empty.");
    }

    const embedding = await generateGeminiEmbedding({
      apiKey: this.apiKey,
      model: this.modelName,
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
