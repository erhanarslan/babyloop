export type RedactionResult = {
  redactedText: string;
  redactions: Array<"email" | "phone" | "secret">;
};

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu;
const PHONE_PATTERN = /(?:\+90|0)?[\s.-]?\(?5\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}\b/gu;
const SECRET_PATTERN = /\b(?:sk-[A-Za-z0-9_-]{16,}|AIza[A-Za-z0-9_-]{20,}|[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,})\b/gu;

export function redactPii(input: string): RedactionResult {
  const redactions = new Set<RedactionResult["redactions"][number]>();
  let redactedText = input.replace(EMAIL_PATTERN, () => {
    redactions.add("email");
    return "[redacted_email]";
  });

  redactedText = redactedText.replace(PHONE_PATTERN, () => {
    redactions.add("phone");
    return "[redacted_phone]";
  });

  redactedText = redactedText.replace(SECRET_PATTERN, () => {
    redactions.add("secret");
    return "[redacted_secret]";
  });

  return {
    redactedText,
    redactions: Array.from(redactions)
  };
}
