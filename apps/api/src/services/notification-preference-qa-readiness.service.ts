export type NotificationPreferenceQaSurface = "backoffice" | "mobile" | "web";
export type NotificationPreferenceQaChannel = "email" | "push" | "in_app" | "n8n";
export type NotificationPreferenceQaSource =
  | "child_reminder"
  | "saved_search"
  | "child_lifecycle"
  | "marketplace"
  | "messages"
  | "trust_safety";

export type NotificationPreferenceQaScenario = {
  surface: NotificationPreferenceQaSurface;
  channel: NotificationPreferenceQaChannel;
  source: NotificationPreferenceQaSource;
  preferenceVisible: boolean;
  toggleVisible: boolean;
  optOutVisible: boolean;
  auditVisible: boolean;
  disabledStateExplained: boolean;
  consentRequiredExplained: boolean;
  rateLimitExplained: boolean;
  blockedUserSafetyExplained: boolean;
};

export type NotificationPreferenceQaDecision = {
  ready: boolean;
  surface: NotificationPreferenceQaSurface;
  missingChecks: Array<
    | "preference_not_visible"
    | "toggle_not_visible"
    | "opt_out_not_visible"
    | "audit_not_visible"
    | "disabled_state_not_explained"
    | "consent_required_not_explained"
    | "rate_limit_not_explained"
    | "blocked_user_safety_not_explained"
  >;
  providerCallAllowed: false;
  deliveryMutationAllowed: false;
  rawContactLoggingAllowed: false;
  manualQaRequired: true;
  piiSafe: true;
};

export type NotificationPreferenceQaReadiness = {
  status: "readiness_only";
  providerCallsAllowed: false;
  deliveryEnabled: false;
  rawContactLoggingAllowed: false;
  backofficeQaRequired: true;
  mobileQaRequired: true;
  webQaRequired: true;
  manualQaEvidenceRequired: true;
  requiredSurfaces: NotificationPreferenceQaSurface[];
  requiredChannels: NotificationPreferenceQaChannel[];
  requiredSources: NotificationPreferenceQaSource[];
  requiredScenarios: string[];
  blockedUntilImplemented: string[];
  warning: string;
};

export function evaluateNotificationPreferenceQaScenario(
  scenario: NotificationPreferenceQaScenario
): NotificationPreferenceQaDecision {
  const missingChecks: NotificationPreferenceQaDecision["missingChecks"] = [];

  if (!scenario.preferenceVisible) {
    missingChecks.push("preference_not_visible");
  }

  if (!scenario.toggleVisible) {
    missingChecks.push("toggle_not_visible");
  }

  if (!scenario.optOutVisible) {
    missingChecks.push("opt_out_not_visible");
  }

  if (!scenario.auditVisible) {
    missingChecks.push("audit_not_visible");
  }

  if (!scenario.disabledStateExplained) {
    missingChecks.push("disabled_state_not_explained");
  }

  if (!scenario.consentRequiredExplained) {
    missingChecks.push("consent_required_not_explained");
  }

  if (!scenario.rateLimitExplained) {
    missingChecks.push("rate_limit_not_explained");
  }

  if (!scenario.blockedUserSafetyExplained) {
    missingChecks.push("blocked_user_safety_not_explained");
  }

  return {
    ready: missingChecks.length === 0,
    surface: scenario.surface,
    missingChecks,
    providerCallAllowed: false,
    deliveryMutationAllowed: false,
    rawContactLoggingAllowed: false,
    manualQaRequired: true,
    piiSafe: true
  };
}

export function getNotificationPreferenceQaReadiness(): NotificationPreferenceQaReadiness {
  return {
    status: "readiness_only",
    providerCallsAllowed: false,
    deliveryEnabled: false,
    rawContactLoggingAllowed: false,
    backofficeQaRequired: true,
    mobileQaRequired: true,
    webQaRequired: true,
    manualQaEvidenceRequired: true,
    requiredSurfaces: ["backoffice", "mobile", "web"],
    requiredChannels: ["email", "push", "in_app", "n8n"],
    requiredSources: ["child_reminder", "saved_search", "child_lifecycle", "marketplace", "messages", "trust_safety"],
    requiredScenarios: [
      "backoffice notification preferences visible",
      "mobile notification preferences visible",
      "web notification preferences visible",
      "email channel opt-out visible",
      "push channel opt-out visible",
      "in-app channel opt-out visible",
      "n8n channel disabled state visible",
      "child reminder preference visible",
      "saved search preference visible",
      "child lifecycle preference visible",
      "preference audit state visible in backoffice",
      "disabled preference state explained",
      "consent required state explained",
      "rate limit state explained",
      "blocked user safety state explained",
      "manual QA evidence attached"
    ],
    blockedUntilImplemented: [
      "real email sending",
      "real push sending",
      "real n8n workflow triggering",
      "provider calls",
      "queue jobs",
      "raw contact logging",
      "unconsented delivery"
    ],
    warning:
      "Notification preference QA is readiness-only; it does not enable real sending, provider calls, queue jobs, webhook calls, or raw contact logging."
  };
}

export function assertNotificationPreferenceQaReadinessOnly(): {
  providerCallsAllowed: false;
  deliveryEnabled: false;
  rawContactLoggingAllowed: false;
  manualQaEvidenceRequired: true;
} {
  const readiness = getNotificationPreferenceQaReadiness();

  return {
    providerCallsAllowed: readiness.providerCallsAllowed,
    deliveryEnabled: readiness.deliveryEnabled,
    rawContactLoggingAllowed: readiness.rawContactLoggingAllowed,
    manualQaEvidenceRequired: readiness.manualQaEvidenceRequired
  };
}
