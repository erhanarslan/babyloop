import {
  MOBILE_ACCOUNT_DELETION_CONFIRMATION,
  getMobileAccountDeletionErrorMessage,
  normalizeMobileAccountDeletionCode,
  validateMobileAccountDeletionConfirmation
} from "./security-model";

describe("mobile account deletion model", () => {
  it("normalizes the OTP to six digits", () => {
    expect(normalizeMobileAccountDeletionCode("12a 34-5678")).toBe("123456");
  });

  it("requires the exact irreversible confirmation phrase", () => {
    expect(
      validateMobileAccountDeletionConfirmation({
        code: "123456",
        confirmation: "SİL"
      })
    ).toContain(MOBILE_ACCOUNT_DELETION_CONFIRMATION);

    expect(
      validateMobileAccountDeletionConfirmation({
        code: "123456",
        confirmation: MOBILE_ACCOUNT_DELETION_CONFIRMATION
      })
    ).toBeNull();
  });

  it("maps API failures without exposing backend details", () => {
    expect(
      getMobileAccountDeletionErrorMessage(
        "INVALID_CURRENT_PASSWORD",
        "raw backend message"
      )
    ).toBe("Mevcut şifre doğru değil.");

    expect(
      getMobileAccountDeletionErrorMessage(
        "ACCOUNT_DELETION_CHALLENGE_INVALID",
        "raw backend message"
      )
    ).not.toContain("raw backend");
  });
});
