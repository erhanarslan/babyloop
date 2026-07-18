import { describe, expect, it } from "vitest";

import {
  ACCOUNT_DELETION_CONFIRMATION,
  getAccountDeletionErrorMessage,
  normalizeAccountDeletionCode,
  validateAccountDeletionConfirmation
} from "./account-deletion-model";

describe("account deletion model", () => {
  it("normalizes the OTP to six digits", () => {
    expect(normalizeAccountDeletionCode("12a 34-5678")).toBe("123456");
  });

  it("requires the exact irreversible confirmation phrase", () => {
    expect(
      validateAccountDeletionConfirmation({
        code: "123456",
        confirmation: "hesabımı sil"
      })
    ).toContain(ACCOUNT_DELETION_CONFIRMATION);

    expect(
      validateAccountDeletionConfirmation({
        code: "123456",
        confirmation: ACCOUNT_DELETION_CONFIRMATION
      })
    ).toBeNull();
  });

  it("maps security failures to user-safe Turkish messages", () => {
    expect(
      getAccountDeletionErrorMessage(
        "INVALID_CURRENT_PASSWORD",
        "raw backend message"
      )
    ).toBe("Mevcut şifre doğru değil.");

    expect(
      getAccountDeletionErrorMessage(
        "ACCOUNT_DELETION_CHALLENGE_INVALID",
        "raw backend message"
      )
    ).not.toContain("raw backend");
  });
});
