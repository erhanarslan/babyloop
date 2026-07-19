import type { ListingImageAuthenticityDecision } from "./listing-image-authenticity.service.js";

export const PROHIBITED_LISTING_PRODUCT_CODES = [
  "weapon_or_ammunition",
  "tobacco_nicotine_or_vape",
  "alcohol",
  "illegal_drug_or_paraphernalia",
  "prescription_or_unlicensed_medical_product",
  "adult_or_sexual_product",
  "recalled_or_banned_child_product",
  "hazardous_chemical_or_explosive",
  "counterfeit_or_stolen_product",
  "live_animal",
  "other_policy_concern"
] as const;

export const LISTING_IMAGE_PRODUCT_POLICY_VERSION = "babyloop_listing_product_policy.v1";

export type ProhibitedListingProductCode = typeof PROHIBITED_LISTING_PRODUCT_CODES[number];

export type ListingImageProductPolicySignals = {
  containsSensitiveChildContent: boolean;
  isRealProductPhoto: boolean;
  isRelevantToListing: boolean;
  prohibitedProductCode: ProhibitedListingProductCode | null;
  prohibitedProductConfidence: number;
  prohibitedProductDetected: boolean;
};

export type ListingImageProductPolicyResult = {
  action: "allow" | "manual_review" | "reject";
  decision: ListingImageAuthenticityDecision;
  reason: string | null;
  signals: ListingImageProductPolicySignals;
};

const HIGH_CONFIDENCE_THRESHOLD = 0.85;

export function enforceListingImageProductPolicy(input: {
  confidence: number;
  providerDecision: ListingImageAuthenticityDecision;
  signals: ListingImageProductPolicySignals;
}): ListingImageProductPolicyResult {
  const { signals } = input;

  if (signals.prohibitedProductDetected) {
    if (signals.prohibitedProductConfidence >= HIGH_CONFIDENCE_THRESHOLD) {
      return result(
        "reject",
        "reject",
        "Bu ürün BabyLoop yasaklı ürün politikasına uygun görünmüyor; görsel yüklenmedi.",
        signals
      );
    }

    return result(
      "manual_review",
      "needs_review",
      "Görselde yasaklı ürün olasılığı tespit edildi ve moderasyon incelemesine alındı.",
      signals
    );
  }

  if (signals.containsSensitiveChildContent) {
    const highConfidence = input.confidence >= HIGH_CONFIDENCE_THRESHOLD;

    return result(
      highConfidence ? "reject" : "manual_review",
      highConfidence ? "reject" : "needs_review",
      highConfidence
        ? "Görsel çocuk güvenliği veya mahremiyeti açısından kabul edilemedi."
        : "Görsel çocuk güvenliği ve mahremiyeti incelemesine alındı.",
      signals
    );
  }

  if ((!signals.isRealProductPhoto || !signals.isRelevantToListing) && input.confidence >= HIGH_CONFIDENCE_THRESHOLD) {
    return result(
      "reject",
      "reject",
      "Görsel ilandaki gerçek ürünü açıkça göstermiyor; lütfen ürüne ait kendi fotoğrafını yükle.",
      signals
    );
  }

  if (!signals.isRealProductPhoto || !signals.isRelevantToListing) {
    return result(
      "manual_review",
      "needs_review",
      "Görselin gerçek ve ilanla ilgili bir ürün fotoğrafı olduğu kesin doğrulanamadı.",
      signals
    );
  }

  if (input.providerDecision === "reject") {
    return result("reject", "reject", null, signals);
  }

  if (input.providerDecision === "needs_review") {
    return result("manual_review", "needs_review", null, signals);
  }

  return result("allow", "allow", null, signals);
}

export function normalizeProhibitedListingProductCode(value: unknown): ProhibitedListingProductCode | null {
  return typeof value === "string" && PROHIBITED_LISTING_PRODUCT_CODES.includes(
    value as ProhibitedListingProductCode
  )
    ? value as ProhibitedListingProductCode
    : null;
}

function result(
  action: ListingImageProductPolicyResult["action"],
  decision: ListingImageProductPolicyResult["decision"],
  reason: string | null,
  signals: ListingImageProductPolicySignals
): ListingImageProductPolicyResult {
  return { action, decision, reason, signals };
}
