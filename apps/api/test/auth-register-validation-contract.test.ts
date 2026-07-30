import { CURRENT_TERMS_VERSION } from "@babyloop/shared";
import { describe, expect, it } from "vitest";

import {
  registerBodySchema,
  summarizeAuthValidationIssues
} from "../src/schemas/auth.schemas.js";

const validPayload = {
  displayName: "Deneme Kullanıcı",
  email: "synthetic-register@example.test",
  locationCity: "Ataşehir",
  password: "Abcde1!x",
  termsAccepted: true as const,
  termsVersion: CURRENT_TERMS_VERSION
};

describe("register request validation contract", () => {
  it.each([
    ["normal payload", validPayload],
    ["uppercase display name", { ...validPayload, displayName: "DENEME KULLANICI" }],
    ["Turkish display name", { ...validPayload, displayName: "Çağla Şen" }],
    ["Ataşehir", { ...validPayload, locationCity: "Ataşehir" }],
    ["İstanbul", { ...validPayload, locationCity: "İstanbul" }],
    ["empty optional city", { ...validPayload, locationCity: "" }],
    ["omitted optional city", withoutKey(validPayload, "locationCity")],
    ["exactly eight character password", { ...validPayload, password: "Abcde1!x" }],
    ["longer password", { ...validPayload, password: "Abcdef1!xy" }]
  ])("accepts %s", (_name, payload) => {
    expect(registerBodySchema.safeParse(payload).success).toBe(true);
  });

  it("rejects the production modal's old payload shape with exact safe issue metadata", () => {
    const result = registerBodySchema.safeParse({
      displayName: validPayload.displayName,
      email: validPayload.email,
      locationCity: validPayload.locationCity,
      password: validPayload.password
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(summarizeAuthValidationIssues(result.error)).toEqual([
      { code: "invalid_literal", path: "termsAccepted" },
      { code: "invalid_literal", path: "termsVersion" }
    ]);
  });

  it.each([
    ["stale terms version", { ...validPayload, termsVersion: "2026-01-01" }, "termsVersion"],
    ["false terms acceptance", { ...validPayload, termsAccepted: false }, "termsAccepted"],
    ["string terms acceptance", { ...validPayload, termsAccepted: "true" }, "termsAccepted"],
    ["extra clientType", { ...validPayload, clientType: "web" }, "$"],
    ["unknown extra field", { ...validPayload, unexpected: "value" }, "$"]
  ])("rejects %s", (_name, payload, expectedPath) => {
    const result = registerBodySchema.safeParse(payload);

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(summarizeAuthValidationIssues(result.error)).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: expectedPath })])
    );
  });

  it("summarizes path and code without logging input values or Zod messages", () => {
    const sentinel = "SENSITIVE_REGISTER_VALUE_MUST_NOT_LEAK";
    const result = registerBodySchema.safeParse({
      ...validPayload,
      displayName: `<script>${sentinel}</script>`,
      email: sentinel,
      password: sentinel.slice(0, 7),
      termsAccepted: false,
      termsVersion: sentinel
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    const serializedSummary = JSON.stringify(summarizeAuthValidationIssues(result.error));
    expect(serializedSummary).not.toContain(sentinel);
    expect(serializedSummary).not.toContain("script");
    expect(serializedSummary).not.toContain("message");
  });
});

function withoutKey<T extends Record<string, unknown>, K extends keyof T>(
  value: T,
  key: K
): Omit<T, K> {
  return Object.fromEntries(
    Object.entries(value).filter(([entryKey]) => entryKey !== key)
  ) as Omit<T, K>;
}
