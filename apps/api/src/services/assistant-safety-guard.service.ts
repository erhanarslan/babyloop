export type AssistantSafetyRiskLevel = "safe" | "needs_guardrail" | "blocked";

export type AssistantSafetyBlockedReason =
  | "medical_diagnosis"
  | "medication_or_dosage"
  | "treatment_plan"
  | "diet_prescription"
  | "therapy_claim"
  | "unsupported_product_claim"
  | "missing_grounding_for_specific_claim"
  | "sensitive_personal_data";

export type AssistantSafetyGuardInput = {
  userMessage: string;
  assistantDraft: string;
  groundedSourceIds?: string[];
  containsChildContext?: boolean;
};

export type AssistantSafetyGuardDecision = {
  allowed: boolean;
  riskLevel: AssistantSafetyRiskLevel;
  blockedReasons: AssistantSafetyBlockedReason[];
  safeResponse: string;
  requiredDisclaimers: string[];
  sourceRequirements: {
    requiresGroundingForSpecificClaims: true;
    requiresSourceIdsForRag: true;
    maxUnsupportedSpecificClaims: 0;
  };
  medicalBoundary: {
    diagnosisAllowed: false;
    medicationAdviceAllowed: false;
    treatmentPlanAllowed: false;
    dietPrescriptionAllowed: false;
    therapyClaimAllowed: false;
    emergencyRedirectRequired: true;
  };
  privacyBoundary: {
    storeRawChildData: false;
    storeRawMessageBody: false;
    exposeEmailPhoneTokenCookieOtp: false;
  };
};

export type AssistantSafetyGuardPreview = {
  status: "guarded";
  ragRuntimeEnabled: false;
  hallucinationGuardEnabled: true;
  medicalAdviceAllowed: false;
  therapyAdviceAllowed: false;
  medicationAdviceAllowed: false;
  diagnosisAllowed: false;
  treatmentPlanAllowed: false;
  dietPrescriptionAllowed: false;
  requiresGroundingForSpecificClaims: true;
  requiresSourceIdsForRag: true;
  allowedSupportScope: string[];
  blockedAdviceScope: string[];
  warning: string;
};

const BLOCKED_PATTERNS: Array<{ reason: AssistantSafetyBlockedReason; patterns: RegExp[] }> = [
  {
    reason: "medical_diagnosis",
    patterns: [
      /\bdiagnos(?:e|is)\b/iu,
      /\bthis is (?:autism|adhd|allergy|infection|depression|anxiety)\b/iu,
      /\btanı koy/iu,
      /\bteşhis koy/iu,
      /\botizm(?:dir| olabilir| belirtisi)/iu,
      /\benfeksiyon(?:dur| olabilir)/iu
    ]
  },
  {
    reason: "medication_or_dosage",
    patterns: [
      /\b(?:mg|ml)\b.*\b(?:ver|give|dose|dosage)\b/iu,
      /\b(?:paracetamol|ibuprofen|antibiotic|antibiyotik|calpol|dolven|ilaç)\b.*\b(?:ver|kullan|başla|dose|dosage|mg|ml)\b/iu,
      /\bilaç dozu\b/iu,
      /\bşu ilacı\b/iu
    ]
  },
  {
    reason: "treatment_plan",
    patterns: [
      /\btreatment plan\b/iu,
      /tedavi planı/iu,
      /tedaviye başla/iu,
      /şunu uygularsan geçer/iu
    ]
  },
  {
    reason: "diet_prescription",
    patterns: [
      /\bdiet prescription\b/iu,
      /diyet reçetesi/iu,
      /(?:kalori|protein|karbonhidrat).*?(?:zorunlu|kesin|günlük)/iu,
      /şu diyeti uygula/iu,
      /diyeti uygula/iu
    ]
  },
  {
    reason: "therapy_claim",
    patterns: [
      /\btherapy plan\b/iu,
      /\bterapi planı\b/iu,
      /\bpsikolojik tedavi\b/iu,
      /\bthis will cure\b/iu,
      /\bkesin çözüm\b/iu
    ]
  },
  {
    reason: "unsupported_product_claim",
    patterns: [
      /\bguaranteed safe\b/iu,
      /\b100% safe\b/iu,
      /\bkesin güvenli\b/iu,
      /\basla zarar vermez\b/iu
    ]
  },
  {
    reason: "sensitive_personal_data",
    patterns: [
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu,
      /\b(?:accessToken|refreshToken|password|otp|cookie|authorization)\b/iu
    ]
  }
];

const SPECIFIC_CLAIM_PATTERNS = [
  /\b(?:araştırmalar|studies|clinical|klinik|kanıtlandı|proven|istatistik|%\s?\d+)\b/iu,
  /\b\d+\s?(?:ay|month|hafta|week|gün|day)\b.*\b(?:olmalı|should|must|gerekir)\b/iu,
  /\b(?:her çocuk|all children|always|never|asla|kesinlikle)\b/iu
];

export function evaluateAssistantSafetyGuard(input: AssistantSafetyGuardInput): AssistantSafetyGuardDecision {
  const combined = `${input.userMessage}\n${input.assistantDraft}`;
  const blockedReasons = collectBlockedReasons(combined);
  const hasSpecificClaims = SPECIFIC_CLAIM_PATTERNS.some((pattern) => pattern.test(input.assistantDraft));
  const hasGrounding = Boolean(input.groundedSourceIds?.length);

  if (hasSpecificClaims && !hasGrounding) {
    blockedReasons.add("missing_grounding_for_specific_claim");
  }

  const allowed = blockedReasons.size === 0;

  return {
    allowed,
    riskLevel: allowed ? "safe" : blockedReasons.has("missing_grounding_for_specific_claim") && blockedReasons.size === 1 ? "needs_guardrail" : "blocked",
    blockedReasons: [...blockedReasons].sort(),
    safeResponse: allowed ? sanitizeAllowedResponse(input.assistantDraft) : buildSafeRefusal([...blockedReasons].sort()),
    requiredDisclaimers: buildRequiredDisclaimers([...blockedReasons].sort()),
    sourceRequirements: {
      requiresGroundingForSpecificClaims: true,
      requiresSourceIdsForRag: true,
      maxUnsupportedSpecificClaims: 0
    },
    medicalBoundary: {
      diagnosisAllowed: false,
      medicationAdviceAllowed: false,
      treatmentPlanAllowed: false,
      dietPrescriptionAllowed: false,
      therapyClaimAllowed: false,
      emergencyRedirectRequired: true
    },
    privacyBoundary: {
      storeRawChildData: false,
      storeRawMessageBody: false,
      exposeEmailPhoneTokenCookieOtp: false
    }
  };
}

export function getAssistantSafetyGuardPreview(): AssistantSafetyGuardPreview {
  return {
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
    requiresSourceIdsForRag: true,
    allowedSupportScope: [
      "everyday parenting checklists",
      "age-band shopping reminders",
      "comfort and routine suggestions",
      "non-medical safety reminders",
      "human referral suggestion when relevant"
    ],
    blockedAdviceScope: [
      "medical diagnosis",
      "medication or dosage advice",
      "treatment plans",
      "diet prescriptions",
      "therapy claims",
      "unsupported product safety claims"
    ],
    warning:
      "Assistant safety guard is a boundary/readiness layer only; it does not enable medical diagnosis, medication advice, treatment plans, diet prescriptions, therapy claims, autonomous RAG answers, or unsupported product claims."
  };
}

function collectBlockedReasons(text: string): Set<AssistantSafetyBlockedReason> {
  const blockedReasons = new Set<AssistantSafetyBlockedReason>();

  for (const group of BLOCKED_PATTERNS) {
    if (group.patterns.some((pattern) => pattern.test(text))) {
      blockedReasons.add(group.reason);
    }
  }

  return blockedReasons;
}

function sanitizeAllowedResponse(response: string): string {
  return response
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, "[redacted-email]")
    .replace(/\b(?:accessToken|refreshToken|password|otp|cookie|authorization)\b/giu, "[redacted-secret]")
    .slice(0, 4000);
}

function buildSafeRefusal(reasons: AssistantSafetyBlockedReason[]): string {
  const includesMedicalBoundary = reasons.some((reason) =>
    ["medical_diagnosis", "medication_or_dosage", "treatment_plan", "diet_prescription", "therapy_claim"].includes(reason)
  );

  if (includesMedicalBoundary) {
    return [
      "Bu konuda tanı, ilaç/doz, tedavi, diyet reçetesi veya terapi planı veremem.",
      "Güvenli şekilde genel gözlem listesi, doktora/uzmana sorulacak sorular ve günlük bakım için risksiz hatırlatmalar hazırlayabilirim.",
      "Acil, hızlı kötüleşen veya ciddi belirti varsa gecikmeden bir sağlık profesyoneline ya da acil hizmetlere başvurun."
    ].join(" ");
  }

  if (reasons.includes("missing_grounding_for_specific_claim")) {
    return "Bu iddiayı kaynakla doğrulamadan kesin bilgi gibi sunamam. Kaynaklı ve sınırlı bir yanıt ya da genel kontrol listesi hazırlayabilirim.";
  }

  return "Bu yanıt BabyLoop güvenlik sınırlarını aşıyor. Daha genel, kaynaklı ve güvenli bir ebeveyn destek yanıtı hazırlayabilirim.";
}

function buildRequiredDisclaimers(reasons: AssistantSafetyBlockedReason[]): string[] {
  const disclaimers = [
    "BabyLoop tıbbi, terapi, tanı, ilaç/doz, tedavi veya diyet reçetesi platformu değildir."
  ];

  if (reasons.includes("missing_grounding_for_specific_claim")) {
    disclaimers.push("Spesifik iddialar kaynak ve bağlam olmadan kesin bilgi gibi sunulmamalıdır.");
  }

  return disclaimers;
}
