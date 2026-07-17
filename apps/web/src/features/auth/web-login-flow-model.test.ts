import { describe, expect, it } from "vitest";
import {
  canSubmitWebOtpCode,
  normalizeWebOtpCode,
  transitionWebLoginFlowFromMfaVerify,
  transitionWebLoginFlowFromSubmit
} from "./web-login-flow-model";

const authPayload = {
  accessToken: "web-access-token",
  profile: {
    displayName: "Ayşe",
    id: "profile-1",
    locationCity: "İstanbul"
  },
  user: {
    email: "parent@example.test",
    id: "user-1",
    role: "user"
  }
};

const approvalPayload = {
  approvalId: "approval-1",
  approvalToken: "approval-secret-token",
  deviceLabel: "Mac tarayıcı",
  expiresAt: "2030-01-01T10:00:00.000Z",
  loginApprovalRequired: true as const
};

describe("web login flow model", () => {
  it("moves MFA required login responses into OTP stage without exposing challenge details", () => {
    const stage = transitionWebLoginFlowFromSubmit({
      challengeId: "00000000-0000-4000-8000-000000000001",
      devOtpCode: "123456",
      mfaRequired: true
    }, { isRegister: false });

    expect(stage).toEqual({
      type: "mfa",
      challengeId: "00000000-0000-4000-8000-000000000001"
    });
    expect(JSON.stringify(stage)).not.toMatch(/devOtpCode|123456|approvalToken|accessToken/iu);
  });

  it("accepts only 6 digit OTP input", () => {
    expect(normalizeWebOtpCode("12 a3-45 678")).toBe("123456");
    expect(canSubmitWebOtpCode("12345")).toBe(false);
    expect(canSubmitWebOtpCode("123456")).toBe(true);
    expect(canSubmitWebOtpCode("12345a")).toBe(false);
  });

  it("keeps register flow out of MFA and mobile approval stages", () => {
    expect(transitionWebLoginFlowFromSubmit({
      challengeId: "00000000-0000-4000-8000-000000000001",
      mfaRequired: true
    }, { isRegister: true })).toMatchObject({
      type: "error"
    });
    expect(transitionWebLoginFlowFromSubmit(approvalPayload, { isRegister: true })).toMatchObject({
      type: "error"
    });
  });

  it("supports MFA verify returning authenticated or mobile approval payloads", () => {
    expect(transitionWebLoginFlowFromMfaVerify(authPayload)).toMatchObject({
      type: "authenticated",
      auth: authPayload
    });
    expect(transitionWebLoginFlowFromMfaVerify(approvalPayload)).toMatchObject({
      type: "mobile_approval",
      approval: approvalPayload
    });
  });
});
