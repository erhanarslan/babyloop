import { CURRENT_TERMS_VERSION } from "@babyloop/shared";
import { describe, expect, it, vi } from "vitest";

import { buildAuthPayload } from "./auth-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() })
}));

describe("direct register form payload contract", () => {
  it("sends only the API schema fields with current terms acceptance", () => {
    const formData = new FormData();
    formData.set("displayName", "  Çağla Şen  ");
    formData.set("email", "  synthetic-register@example.test  ");
    formData.set("locationCity", "  Ataşehir  ");
    formData.set("password", " Abcde! ");

    expect(buildAuthPayload(formData, true, true)).toEqual({
      displayName: "Çağla Şen",
      email: "synthetic-register@example.test",
      locationCity: "Ataşehir",
      password: " Abcde! ",
      termsAccepted: true,
      termsVersion: CURRENT_TERMS_VERSION
    });
  });

  it("does not build a register payload before terms are accepted", () => {
    const formData = new FormData();
    formData.set("displayName", "Deneme Kullanıcı");
    formData.set("email", "synthetic-register@example.test");
    formData.set("password", "Abcde1!x");

    expect(buildAuthPayload(formData, true, false)).toBeNull();
  });
});
