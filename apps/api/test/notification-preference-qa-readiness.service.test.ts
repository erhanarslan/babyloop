import { describe, expect, it } from "vitest";
import {
  assertNotificationPreferenceQaReadinessOnly,
  evaluateNotificationPreferenceQaScenario,
  getNotificationPreferenceQaReadiness
} from "../src/services/notification-preference-qa-readiness.service.js";

describe("notification preference QA readiness", () => {
  it("accepts a fully visible backoffice preference scenario while keeping delivery disabled", () => {
    const decision = evaluateNotificationPreferenceQaScenario({
      surface: "backoffice",
      channel: "email",
      source: "child_reminder",
      preferenceVisible: true,
      toggleVisible: true,
      optOutVisible: true,
      auditVisible: true,
      disabledStateExplained: true,
      consentRequiredExplained: true,
      rateLimitExplained: true,
      blockedUserSafetyExplained: true
    });

    expect(decision).toEqual({
      ready: true,
      surface: "backoffice",
      missingChecks: [],
      providerCallAllowed: false,
      deliveryMutationAllowed: false,
      rawContactLoggingAllowed: false,
      manualQaRequired: true,
      piiSafe: true
    });
  });

  it("detects missing mobile preference QA coverage", () => {
    const decision = evaluateNotificationPreferenceQaScenario({
      surface: "mobile",
      channel: "push",
      source: "saved_search",
      preferenceVisible: false,
      toggleVisible: false,
      optOutVisible: false,
      auditVisible: false,
      disabledStateExplained: false,
      consentRequiredExplained: false,
      rateLimitExplained: false,
      blockedUserSafetyExplained: false
    });

    expect(decision.ready).toBe(false);
    expect(decision.missingChecks).toEqual(
      expect.arrayContaining([
        "preference_not_visible",
        "toggle_not_visible",
        "opt_out_not_visible",
        "audit_not_visible",
        "disabled_state_not_explained",
        "consent_required_not_explained",
        "rate_limit_not_explained",
        "blocked_user_safety_not_explained"
      ])
    );
    expect(decision.providerCallAllowed).toBe(false);
    expect(decision.deliveryMutationAllowed).toBe(false);
  });

  it("defines required surfaces, channels, sources, and manual QA evidence", () => {
    const readiness = getNotificationPreferenceQaReadiness();

    expect(readiness).toMatchObject({
      status: "readiness_only",
      providerCallsAllowed: false,
      deliveryEnabled: false,
      rawContactLoggingAllowed: false,
      backofficeQaRequired: true,
      mobileQaRequired: true,
      webQaRequired: true,
      manualQaEvidenceRequired: true
    });

    expect(readiness.requiredSurfaces).toEqual(expect.arrayContaining(["backoffice", "mobile", "web"]));
    expect(readiness.requiredChannels).toEqual(expect.arrayContaining(["email", "push", "in_app", "n8n"]));
    expect(readiness.requiredSources).toEqual(
      expect.arrayContaining(["child_reminder", "saved_search", "child_lifecycle", "marketing", "security"])
    );
  });

  it("keeps real delivery and raw contact logging blocked", () => {
    const readiness = getNotificationPreferenceQaReadiness();

    expect(readiness.requiredScenarios).toEqual(
      expect.arrayContaining([
        "backoffice notification preferences visible",
        "mobile notification preferences visible",
        "preference audit state visible in backoffice",
        "manual QA evidence attached"
      ])
    );
    expect(readiness.blockedUntilImplemented).toEqual(
      expect.arrayContaining(["real email sending", "real push sending", "real n8n workflow triggering"])
    );
    expect(JSON.stringify(readiness)).not.toMatch(/parent@example\.com|\+905|access-token-secret|refresh-token-secret|raw-contact-secret/iu);
  });

  it("exposes compact readiness-only assertion", () => {
    expect(assertNotificationPreferenceQaReadinessOnly()).toEqual({
      providerCallsAllowed: false,
      deliveryEnabled: false,
      rawContactLoggingAllowed: false,
      manualQaEvidenceRequired: true
    });
  });
});
