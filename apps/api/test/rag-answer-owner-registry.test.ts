import { describe, expect, it } from "vitest";
import { getRagAnswerOwnerPolicy, isToolAllowedByPolicy } from "../src/services/rag-answer-owner-registry.js";

describe("rag answer owner registry", () => {
  it("requires feeding canonical owner and forbids marketplace tools", () => {
    const policy = getRagAnswerOwnerPolicy("feeding");

    expect(policy.owner).toBe("feeding-and-food-safety-canon");
    expect(policy.allowedSourcePaths).toContain("docs/rag/44-feeding-and-food-safety-canon.md");
    expect(policy.allowedTopics).toContain("feeding-food-safety");
    expect(policy.forbiddenTopics).toContain("toy-safety");
    expect(policy.minimumReliability).toBe("official-referenced");
    expect(policy.requireCanonicalOwner).toBe(true);
    expect(isToolAllowedByPolicy(policy, "rag_search")).toBe(true);
    expect(isToolAllowedByPolicy(policy, "child_needs_recommendations")).toBe(false);
    expect(isToolAllowedByPolicy(policy, "listing_search")).toBe(false);
  });

  it("allows child product tools only for explicit child product needs", () => {
    const policy = getRagAnswerOwnerPolicy("child_product_needs");

    expect(isToolAllowedByPolicy(policy, "child_needs_recommendations")).toBe(true);
    expect(policy.forbiddenTopics).toContain("feeding-food-safety");
  });
});
