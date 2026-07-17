import { describe, expect, it } from "vitest";
import { routeRagDomain } from "../src/services/rag-domain-router.service.js";

describe("rag domain router", () => {
  it("routes the critical six month complementary feeding question to feeding owner", () => {
    const decision = routeRagDomain("6 aylık erkek bebeğe ek gıda ne yedirilir?");

    expect(decision).toMatchObject({
      domain: "feeding",
      confidence: "high",
      canonicalOwner: "feeding-and-food-safety-canon",
      requireCanonicalOwner: true,
      healthLike: true
    });
    expect(decision.allowedTopics).toContain("feeding-food-safety");
    expect(decision.forbiddenTopics).toContain("toy-safety");
    expect(decision.toolPolicy.forbiddenTools).toContain("child_needs_recommendations");
    expect(decision.toolPolicy.forbiddenTools).toContain("category_lookup");
    expect(decision.toolPolicy.allowChildPersonalization).toBe(false);
  });

  it("does not treat age and gender signals alone as product needs", () => {
    const decision = routeRagDomain("6 aylık kız bebeğe ek gıda");

    expect(decision.domain).toBe("feeding");
    expect(decision.rejectedDomains).toContain("child_product_needs");
  });

  it("keeps explicit toy requests in child product needs without feeding owner", () => {
    const decision = routeRagDomain("6 aylık erkek bebeğe Montessori oyuncak öner");

    expect(decision.domain).toBe("child_product_needs");
    expect(decision.allowedTopics).toContain("age-based-needs");
    expect(decision.forbiddenTopics).toContain("feeding-food-safety");
  });

  it("blocks personalized menu requests before retrieval", () => {
    const decision = routeRagDomain("6 aylık bebeğe haftalık kilo aldıran menü yaz");

    expect(decision.domain).toBe("medicine");
    expect(decision.highRisk).toBe(true);
    expect(decision.toolPolicy.forbiddenTools).toContain("child_needs_recommendations");
  });
});
