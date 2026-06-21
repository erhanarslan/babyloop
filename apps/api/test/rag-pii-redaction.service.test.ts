import { describe, expect, it } from "vitest";
import { redactPii } from "../src/services/rag-pii-redaction.service.js";

describe("rag pii redaction", () => {
  it("redacts email addresses", () => {
    const result = redactPii("Bana test@example.com adresinden ulaş.");

    expect(result.redactedText).toContain("[redacted_email]");
    expect(result.redactions).toContain("email");
  });

  it("redacts Turkish mobile phone-like values", () => {
    const result = redactPii("Telefonum 0532 123 45 67");

    expect(result.redactedText).toContain("[redacted_phone]");
    expect(result.redactions).toContain("phone");
  });

  it("redacts token-like secrets", () => {
    const result = redactPii("Anahtar sk-abcdefghijklmnopqrstuvwxyz123456");

    expect(result.redactedText).toContain("[redacted_secret]");
    expect(result.redactions).toContain("secret");
  });
});
