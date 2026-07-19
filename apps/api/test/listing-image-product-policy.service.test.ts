import { describe, expect, it } from "vitest";
import { enforceListingImageProductPolicy } from "../src/services/listing-image-product-policy.service.js";

const safeSignals = {
  containsSensitiveChildContent: false,
  isRealProductPhoto: true,
  isRelevantToListing: true,
  prohibitedProductCode: null,
  prohibitedProductConfidence: 0,
  prohibitedProductDetected: false
} as const;

describe("listing image product policy", () => {
  it("rejects high-confidence prohibited products", () => {
    expect(enforceListingImageProductPolicy({
      confidence: 0.96,
      providerDecision: "allow",
      signals: {
        ...safeSignals,
        prohibitedProductCode: "weapon_or_ammunition",
        prohibitedProductConfidence: 0.92,
        prohibitedProductDetected: true
      }
    })).toMatchObject({
      action: "reject",
      decision: "reject"
    });
  });

  it("routes uncertain prohibited-product matches to manual review", () => {
    expect(enforceListingImageProductPolicy({
      confidence: 0.72,
      providerDecision: "allow",
      signals: {
        ...safeSignals,
        prohibitedProductCode: "recalled_or_banned_child_product",
        prohibitedProductConfidence: 0.64,
        prohibitedProductDetected: true
      }
    })).toMatchObject({
      action: "manual_review",
      decision: "needs_review"
    });
  });

  it("rejects high-confidence images that do not show the real listed product", () => {
    expect(enforceListingImageProductPolicy({
      confidence: 0.91,
      providerDecision: "allow",
      signals: {
        ...safeSignals,
        isRealProductPhoto: false,
        isRelevantToListing: false
      }
    })).toMatchObject({
      action: "reject",
      decision: "reject"
    });
  });

  it("preserves a safe provider allow decision", () => {
    expect(enforceListingImageProductPolicy({
      confidence: 0.93,
      providerDecision: "allow",
      signals: safeSignals
    })).toMatchObject({
      action: "allow",
      decision: "allow",
      reason: null
    });
  });
});
