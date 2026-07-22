import { describe, expect, it } from "vitest";
import {
  formatGeminiEmbeddingInput,
  GeminiEmbeddingProvider
} from "@babyloop/ai-core";

const vector3072 = () => Array.from({ length: 3072 }, (_, index) => index / 3072);

describe("Gemini Embedding 2 provider", () => {
  it("formats asymmetric query and document inputs", () => {
    expect(formatGeminiEmbeddingInput({
      purpose: "query",
      text: "  bebek\n arabası   güvenliği "
    })).toBe("task: search result | query: bebek arabası güvenliği");

    expect(formatGeminiEmbeddingInput({
      purpose: "document",
      title: "  Güvenlik | Rehberi ",
      text: " fren\n ve   tekerlek "
    })).toBe("title: Güvenlik Rehberi | text: fren ve tekerlek");

    expect(formatGeminiEmbeddingInput({
      purpose: "document",
      text: "başlıksız içerik"
    })).toBe("title: none | text: başlıksız içerik");
  });

  it("sends the Gemini Embedding 2 REST contract with 3072 dimensions", async () => {
    let requestUrl = "";
    let requestBody: Record<string, unknown> = {};
    let requestHeaders: Record<string, string> = {};

    const provider = new GeminiEmbeddingProvider({
      apiKey: "gemini-test-key",
      model: "models/gemini-embedding-2",
      outputDimension: 3072,
      fetch: async (url, init) => {
        requestUrl = url;
        requestBody = JSON.parse(init.body) as Record<string, unknown>;
        requestHeaders = init.headers;

        return {
          ok: true,
          status: 200,
          async json() {
            return { embedding: { values: vector3072() } };
          },
          async text() {
            return "";
          }
        };
      }
    });

    const result = await provider.embedText({
      purpose: "query",
      text: "bebek arabası"
    });

    expect(requestUrl).toContain("/v1beta/models/gemini-embedding-2:embedContent");
    expect(requestUrl).not.toContain("models%2Fmodels");
    expect(requestHeaders["x-goog-api-key"]).toBe("gemini-test-key");
    expect(requestBody).toMatchObject({
      model: "models/gemini-embedding-2",
      output_dimensionality: 3072,
      content: {
        parts: [
          {
            text: "task: search result | query: bebek arabası"
          }
        ]
      }
    });
    expect(requestBody).not.toHaveProperty("taskType");
    expect(requestBody).not.toHaveProperty("task_type");
    expect(result.embedding).toHaveLength(3072);
    expect(result.promptVersion).toBe("rag_embedding.gemini_embedding_2.asymmetric.v1");
    expect(result.modelName).toBe("gemini-embedding-2");
  });

  it("rejects empty input and unexpected response dimensions", async () => {
    const provider = new GeminiEmbeddingProvider({
      apiKey: "gemini-test-key",
      model: "gemini-embedding-2",
      outputDimension: 3072,
      fetch: async () => ({
        ok: true,
        status: 200,
        async json() {
          return { embedding: { values: [0.1, 0.2] } };
        },
        async text() {
          return "";
        }
      })
    });

    await expect(provider.embedText({
      purpose: "query",
      text: "   "
    })).rejects.toThrow("Embedding text cannot be empty");

    await expect(provider.embedText({
      purpose: "document",
      text: "geçerli içerik"
    })).rejects.toThrow("does not match requested dimension 3072");
  });

  it("keeps API keys out of provider error messages", async () => {
    const provider = new GeminiEmbeddingProvider({
      apiKey: "gemini-secret-that-must-not-leak",
      model: "gemini-embedding-2",
      fetch: async () => ({
        ok: false,
        status: 403,
        async json() {
          return {};
        },
        async text() {
          return "forbidden";
        }
      })
    });

    const error = await provider.embedText({
      purpose: "query",
      text: "test"
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("status 403");
    expect((error as Error).message).not.toContain("gemini-secret-that-must-not-leak");
  });
});
