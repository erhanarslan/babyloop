import { describe, expect, it } from "vitest";
import {
  createSafeTextPreview,
  normalizeWhitespace,
  redactEmails,
  redactPhones,
  redactPrivateText
} from "../src/services/redaction.service.js";

describe("redaction service", () => {
  it("normalizes whitespace", () => {
    expect(normalizeWhitespace("  hello\n\n   world\t ")).toBe("hello world");
  });

  it("redacts email addresses", () => {
    expect(redactEmails("contact parent@example.com now")).toBe(
      "contact [redacted-email] now"
    );
  });

  it("redacts phone numbers", () => {
    expect(redactPhones("call +90 555 111 22 33 today")).toBe(
      "call [redacted-phone] today"
    );
  });

  it("redacts mixed private text", () => {
    expect(
      redactPrivateText("mail parent@example.com or call +90 555 111 22 33")
    ).toBe("mail [redacted-email] or call [redacted-phone]");
  });

  it("creates a safe truncated preview after redaction", () => {
    const preview = createSafeTextPreview(
      "mail parent@example.com or call +90 555 111 22 33 about the listing",
      48
    );

    expect(preview).toContain("[redacted-email]");
    expect(preview).not.toContain("parent@example.com");
    expect(preview).not.toContain("+90 555 111 22 33");
    expect(preview.length).toBeLessThanOrEqual(49);
  });
});
