const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{7,}\d)/g;

export const REDACTED_EMAIL = "[redacted-email]";
export const REDACTED_PHONE = "[redacted-phone]";

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function redactEmails(value: string): string {
  return value.replace(EMAIL_PATTERN, REDACTED_EMAIL);
}

export function redactPhones(value: string): string {
  return value.replace(PHONE_PATTERN, REDACTED_PHONE);
}

export function redactPrivateText(value: string): string {
  return redactPhones(redactEmails(value));
}

export function createSafeTextPreview(value: string, maxLength = 120): string {
  const redacted = normalizeWhitespace(redactPrivateText(value));

  if (redacted.length <= maxLength) {
    return redacted;
  }

  return `${redacted.slice(0, maxLength).trimEnd()}…`;
}
