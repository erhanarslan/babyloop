import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registerRagRoutes } from "../src/routes/rag.routes.js";
import type { RagSearchService } from "../src/services/rag-search.service.js";

describe("rag routes", () => {
  it("returns unavailable when RAG service is not configured", async () => {
    const app = Fastify();
    registerRagRoutes(app);
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/rag/search",
      payload: {
        query: "bebek arabası"
      }
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "RAG_UNAVAILABLE"
      }
    });
    await app.close();
  });

  it("returns safe search results from configured service", async () => {
    const app = Fastify();
    const ragSearchService = {
      async search() {
        return [
          {
            score: 0.86,
            text: "Bebek arabasında fren kontrol edilir.",
            citation: {
              title: "Ürün seçimi kontrol rehberleri",
              sourcePath: "docs/rag/04-product-buying-guides.md",
              section: "Bebek arabası",
              topic: "product-buying"
            }
          }
        ];
      }
    } as unknown as RagSearchService;
    registerRagRoutes(app, { ragSearchService });
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/rag/search",
      payload: {
        query: "bebek arabası",
        limit: 3
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      data: {
        query: "bebek arabası",
        results: [
          {
            citation: {
              title: "Ürün seçimi kontrol rehberleri"
            }
          }
        ]
      }
    });
    await app.close();
  });
});
