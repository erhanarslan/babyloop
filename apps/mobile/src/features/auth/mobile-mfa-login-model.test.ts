import {
  canSubmitMobileOtpCode,
  getMobileLoginScreenCopy,
  getMobileLoginScreenMode,
  getMobileMfaCancelReset,
  sanitizeMobileOtpInput
} from "./mobile-mfa-login-model";
import type { MobileMfaChallenge } from "./auth-api";

const challenge: MobileMfaChallenge = {
  challengeId: "00000000-0000-4000-8000-000000000001",
  mfaRequired: true
};

describe("mobile MFA login screen model", () => {
  it("enters MFA mode only when the API returned an MFA challenge", () => {
    expect(getMobileLoginScreenMode({ status: "mfa_required", mfaChallenge: challenge })).toBe("mfa");
    expect(getMobileLoginScreenMode({ status: "mfa_required", mfaChallenge: null })).toBe("credentials");
    expect(getMobileLoginScreenMode({ status: "authenticated", mfaChallenge: challenge })).toBe("credentials");
  });

  it("normalizes OTP input to exactly six digits without leaking the raw value", () => {
    const normalized = sanitizeMobileOtpInput(" 12a34-56 accessToken=secret refreshToken=secret ");

    expect(normalized).toBe("123456");
    expect(normalized).toHaveLength(6);
    expect(JSON.stringify({ normalized })).not.toMatch(/accessToken|refreshToken|passwordHash|currentPassword/iu);
  });

  it("allows verify submit only for a six digit OTP code", () => {
    expect(canSubmitMobileOtpCode("")).toBe(false);
    expect(canSubmitMobileOtpCode("12345")).toBe(false);
    expect(canSubmitMobileOtpCode("123456")).toBe(true);
    expect(canSubmitMobileOtpCode("1234567")).toBe(false);
    expect(canSubmitMobileOtpCode("12345a")).toBe(false);
  });

  it("keeps credential and MFA copy privacy-safe", () => {
    const copy = [
      getMobileLoginScreenCopy("credentials"),
      getMobileLoginScreenCopy("mfa")
    ];

    expect(copy[0].helperText).toContain("SecureStore");
    expect(copy[0].helperText).toContain("AsyncStorage");
    expect(copy[1].title).toBe("OTP doğrulaması");
    expect(JSON.stringify(copy)).not.toMatch(/accessToken=|refreshToken=|passwordHash|currentPassword|devOtpCode/iu);
  });

  it("documents cancel MFA reset state without authenticating the user", () => {
    expect(getMobileMfaCancelReset()).toEqual({
      otpCode: "",
      nextStatus: "guest"
    });
  });
});
