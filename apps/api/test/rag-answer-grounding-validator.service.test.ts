import { describe, expect, it } from "vitest";
import { validateRagAnswerGrounding } from "../src/services/rag-answer-grounding-validator.service.js";
import { routeRagDomain } from "../src/services/rag-domain-router.service.js";

describe("rag answer grounding validator", () => {
  it("allows feeding answers grounded in the feeding canonical owner", () => {
    const decision = routeRagDomain("6 aylık bebek ne yer?");
    const validation = validateRagAnswerGrounding({
      answer: "Ek gıda genel geçiştir; kişiselleştirilmiş menü değildir.",
      domainDecision: decision,
      citations: [{
        title: "Feeding and Food Safety Canon",
        sourcePath: "docs/rag/44-feeding-and-food-safety-canon.md",
        topic: "feeding-food-safety",
        sourceReliability: "official-referenced",
        answerOwner: "feeding-and-food-safety-canon"
      }]
    });

    expect(validation).toMatchObject({
      allowed: true,
      status: "grounded"
    });
  });

  it("blocks feeding answers that cite toy or marketplace topics", () => {
    const decision = routeRagDomain("6 aylık erkek bebeğe ek gıda ne yedirilir?");
    const validation = validateRagAnswerGrounding({
      answer: "Montessori oyuncak kategorilerini inceleyebilirsin.",
      domainDecision: decision,
      citations: [{
        title: "Oyuncak güvenliği",
        sourcePath: "docs/rag/09-toy-safety-checklist.md",
        topic: "toy-safety",
        sourceReliability: "editorial"
      }]
    });

    expect(validation.allowed).toBe(false);
    expect(validation.status).toBe("cross_domain_contamination");
    expect(validation.rejectedReasons).toContain("forbidden_source_topic");
    expect(validation.rejectedReasons).toContain("forbidden_domain_vocabulary");
  });
});
