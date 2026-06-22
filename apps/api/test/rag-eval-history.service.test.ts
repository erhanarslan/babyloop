import { describe, expect, it } from "vitest";
import { RagEvalHistoryService } from "../src/services/rag-eval-history.service.js";
import type { RagEvalRunSummary } from "../src/services/rag-eval-runner.service.js";

describe("rag eval history service", () => {
  it("records eval runs and returns list/detail without long result payload in list", () => {
    const service = new RagEvalHistoryService({ maxRuns: 2 });
    const first = service.record(createSummary("mock", true));
    const second = service.record(createSummary("live", false), "failed");
    service.record(createSummary("mock", true));

    const list = service.list();

    expect(list).toHaveLength(2);
    expect(list.some((entry) => entry.runId === first.runId)).toBe(false);
    expect(list.some((entry) => entry.runId === second.runId)).toBe(true);
    expect(JSON.stringify(list)).not.toContain("results");
    expect(service.get(second.runId)?.status).toBe("failed");
    expect(service.get(second.runId)?.results[0]?.issues).toContain("mode_mismatch");
  });
});

function createSummary(mode: "mock" | "live", passed: boolean): RagEvalRunSummary {
  return {
    mode,
    total: 1,
    passed: passed ? 1 : 0,
    failed: passed ? 0 : 1,
    durationMs: 12,
    results: [
      {
        id: passed ? "passed-case" : "failed-case",
        query: "Bebek arabası alırken nelere bakmalıyım?",
        expectedMode: "rag",
        actualMode: passed ? "rag" : "no_source",
        passed,
        score: passed ? 0.9 : 0,
        sources: passed
          ? [{
              title: "Bebek arabası rehberi",
              sourcePath: "docs/rag/07-stroller-buying-checklist.md",
              topic: "stroller-safety"
            }]
          : [],
        issues: passed ? [] : ["mode_mismatch" as const]
      }
    ]
  };
}
