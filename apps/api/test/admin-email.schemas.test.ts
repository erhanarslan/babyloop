import { describe, expect, it } from "vitest";
import { adminEmailTestSendBodySchema } from "../src/schemas/admin-email.schemas.js";

describe("admin email schemas", () => {
  it("normalizes valid admin test-send body", () => {
    const parsed = adminEmailTestSendBodySchema.parse({
      to: "  ADMIN@EXAMPLE.TEST ",
      note: " SMTP smoke test "
    });

    expect(parsed).toEqual({
      to: "admin@example.test",
      intent: "security_alert",
      note: "SMTP smoke test"
    });
  });

  it("accepts explicit supported test-send intents", () => {
    expect(
      adminEmailTestSendBodySchema.parse({
        to: "admin@example.test",
        intent: "password_reset"
      }).intent
    ).toBe("password_reset");
  });

  it("rejects invalid test-send body", () => {
    expect(() =>
      adminEmailTestSendBodySchema.parse({
        to: "not-email",
        intent: "unknown"
      })
    ).toThrow();
  });

  it("rejects unexpected fields", () => {
    expect(() =>
      adminEmailTestSendBodySchema.parse({
        to: "admin@example.test",
        token: "secret-token"
      })
    ).toThrow();
  });
});
