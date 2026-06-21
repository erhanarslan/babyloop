import { describe, expect, it } from "vitest";
import { RagMetricsService } from "../src/services/rag-metrics.service.js";

describe("rag metrics service", () => {
  it("records request, mode, intent and cache counters", async () => {
    const metrics = new RagMetricsService({
      backend: "memory",
      enabled: true,
      keyPrefix: "test:rag"
    });

    await metrics.recordRequest("assistant");
    await metrics.recordAnswer({
      sources: [
        {
          title: "Kaynak",
          sourcePath: "docs/rag/test.md",
          topic: "safe-shopping"
        }
      ],
      mode: "rag",
      grounded: true,
      intent: "rag_knowledge",
      cacheHit: true
    });

    const snapshot = await metrics.snapshot();

    expect(snapshot).toMatchObject({
      enabled: true,
      backend: "memory",
      backendEffective: "memory"
    });
    expect(snapshot.counters.totalRequests).toBe(1);
    expect(snapshot.counters.assistantRequests).toBe(1);
    expect(snapshot.counters.ragResponses).toBe(1);
    expect(snapshot.counters.cacheHits).toBe(1);
    expect(snapshot.byIntent.rag_knowledge).toBe(1);
    expect(snapshot.byMode.rag).toBe(1);
    expect(snapshot.byTopic["safe-shopping"]).toBe(1);
  });

  it("does not record when disabled", async () => {
    const metrics = new RagMetricsService({
      backend: "memory",
      enabled: false,
      keyPrefix: "test:rag"
    });

    await metrics.recordRequest("search");

    expect((await metrics.snapshot()).counters.totalRequests).toBe(0);
  });
});
