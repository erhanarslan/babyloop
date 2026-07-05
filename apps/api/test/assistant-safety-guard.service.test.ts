import { describe, expect, it } from "vitest";
import {
  evaluateAssistantSafetyGuard,
  getAssistantSafetyGuardPreview
} from "../src/services/assistant-safety-guard.service.js";

describe("assistant safety guard", () => {
  it("blocks medical diagnosis, medication, and treatment-plan drafts", () => {
    const decision = evaluateAssistantSafetyGuard({
      userMessage: "Çocuğum ateşli, ne yapayım?",
      assistantDraft:
        "Bu enfeksiyondur. Şu ilacı 5 ml ver ve tedavi planı olarak üç gün uygula. Geçmezse antibiyotik başla.",
      containsChildContext: true
    });

    expect(decision.allowed).toBe(false);
    expect(decision.riskLevel).toBe("blocked");
    expect(decision.blockedReasons).toEqual(
      expect.arrayContaining(["medical_diagnosis", "medication_or_dosage", "treatment_plan"])
    );
    expect(decision.medicalBoundary).toEqual({
      diagnosisAllowed: false,
      medicationAdviceAllowed: false,
      treatmentPlanAllowed: false,
      dietPrescriptionAllowed: false,
      therapyClaimAllowed: false,
      emergencyRedirectRequired: true
    });
    expect(decision.safeResponse).toContain("tanı, ilaç/doz, tedavi");
    expect(JSON.stringify(decision)).not.toMatch(/antibiyotik başla|5 ml ver|enfeksiyondur/iu);
  });

  it("blocks therapy and diet prescription claims", () => {
    const decision = evaluateAssistantSafetyGuard({
      userMessage: "Çocuğum yemek seçiyor ve hırçın.",
      assistantDraft:
        "Bunun için kesin çözüm şu diyeti uygula ve terapi planı olarak her gün bu psikolojik tedavi rutinini yap."
    });

    expect(decision.allowed).toBe(false);
    expect(decision.blockedReasons).toEqual(
      expect.arrayContaining(["diet_prescription", "therapy_claim"])
    );
    expect(decision.requiredDisclaimers[0]).toContain("tıbbi, terapi, tanı");
  });

  it("requires grounding for specific claims and statistics", () => {
    const decision = evaluateAssistantSafetyGuard({
      userMessage: "18 aylık çocuk için oyuncak öner.",
      assistantDraft:
        "Araştırmalar 18 ay çocukların kesinlikle bu oyuncağı kullanması gerektiğini kanıtladı."
    });

    expect(decision.allowed).toBe(false);
    expect(decision.riskLevel).toBe("needs_guardrail");
    expect(decision.blockedReasons).toEqual(["missing_grounding_for_specific_claim"]);
    expect(decision.sourceRequirements).toMatchObject({
      requiresGroundingForSpecificClaims: true,
      requiresSourceIdsForRag: true,
      maxUnsupportedSpecificClaims: 0
    });
  });

  it("allows everyday parenting support when it avoids medical and unsupported claims", () => {
    const decision = evaluateAssistantSafetyGuard({
      userMessage: "Uyku rutinini nasıl sakinleştirebilirim?",
      assistantDraft:
        "Akşam aynı sırayı koruyabilirsin: kısa oyun, banyo, pijama, loş ışık ve kısa masal. Çocuğun tepkisine göre süreyi yumuşakça ayarla.",
      groundedSourceIds: ["parenting-checklist-v1"],
      containsChildContext: true
    });

    expect(decision.allowed).toBe(true);
    expect(decision.riskLevel).toBe("safe");
    expect(decision.blockedReasons).toEqual([]);
    expect(decision.safeResponse).toContain("Akşam aynı sırayı");
  });

  it("redacts sensitive values from allowed responses", () => {
    const decision = evaluateAssistantSafetyGuard({
      userMessage: "not al",
      assistantDraft: "Planı sonra konuşuruz. parent@example.com accessToken session-cookie-secret",
      groundedSourceIds: ["safe-note"]
    });

    expect(decision.allowed).toBe(false);
    expect(decision.blockedReasons).toContain("sensitive_personal_data");
    expect(JSON.stringify(decision)).not.toMatch(/parent@example.com|accessToken\b|session-cookie-secret/iu);
  });

  it("exposes a guarded preview for release gates", () => {
    const preview = getAssistantSafetyGuardPreview();

    expect(preview).toMatchObject({
      status: "guarded",
      ragRuntimeEnabled: false,
      hallucinationGuardEnabled: true,
      medicalAdviceAllowed: false,
      therapyAdviceAllowed: false,
      medicationAdviceAllowed: false,
      diagnosisAllowed: false,
      treatmentPlanAllowed: false,
      dietPrescriptionAllowed: false,
      requiresGroundingForSpecificClaims: true,
      requiresSourceIdsForRag: true
    });
    expect(preview.allowedSupportScope).toContain("everyday parenting checklists");
    expect(preview.blockedAdviceScope).toEqual(
      expect.arrayContaining([
        "medical diagnosis",
        "medication or dosage advice",
        "treatment plans",
        "diet prescriptions",
        "therapy claims"
      ])
    );
    expect(preview.warning).toContain("does not enable medical diagnosis");
  });
});
