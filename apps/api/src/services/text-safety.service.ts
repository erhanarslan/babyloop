export type PlainTextValidationOptions = {
  allowMultiline?: boolean;
  maxLength?: number;
  minLength?: number;
};

export type PlainTextValidationResult =
  | { ok: true; value: string }
  | {
      ok: false;
      code: "DANGEROUS_HTML" | "EMPTY_TEXT" | "NULL_BYTE" | "TEXT_TOO_LONG";
      message: string;
    };

const DANGEROUS_HTML_PATTERNS = [
  /<\s*\/?\s*(script|iframe|object|embed|svg|img|math|link|meta|style|base)\b/i,
  /\bon[a-z]+\s*=/i,
  /\b(?:javascript|vbscript)\s*:/i,
  /\bdata\s*:\s*text\/html/i,
  /\bexpression\s*\(/i
];

const CONTROL_CHAR_PATTERN = /[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]+/g;

export function normalizePlainText(
  input: string,
  options: PlainTextValidationOptions = {}
): string {
  const allowMultiline = options.allowMultiline ?? false;
  const normalizedLineEndings = input.normalize("NFKC").replace(/\r\n?/g, "\n");
  const normalizedControls = normalizedLineEndings.replace(CONTROL_CHAR_PATTERN, " ");
  const normalizedWhitespace = allowMultiline
    ? normalizedControls
        .split("\n")
        .map((line) => line.replace(/[\t ]+/g, " ").trim())
        .join("\n")
        .replace(/\n{4,}/g, "\n\n\n")
    : normalizedControls.replace(/\s+/g, " ");

  return normalizedWhitespace.trim();
}

export function validatePlainText(
  input: string,
  options: PlainTextValidationOptions = {}
): PlainTextValidationResult {
  if (input.includes("\0")) {
    return {
      ok: false,
      code: "NULL_BYTE",
      message: "Text must not contain null bytes."
    };
  }

  const value = normalizePlainText(input, options);
  const minLength = options.minLength ?? 0;

  if (value.length < minLength) {
    return {
      ok: false,
      code: "EMPTY_TEXT",
      message: "Text is required."
    };
  }

  if (options.maxLength !== undefined && value.length > options.maxLength) {
    return {
      ok: false,
      code: "TEXT_TOO_LONG",
      message: `Text must be at most ${options.maxLength} characters.`
    };
  }

  if (containsDangerousHtml(value)) {
    return {
      ok: false,
      code: "DANGEROUS_HTML",
      message: "Text must be plaintext and must not include HTML or scripts."
    };
  }

  return {
    ok: true,
    value
  };
}

export function assertSafePlainText(
  input: string,
  options: PlainTextValidationOptions = {}
): string {
  const result = validatePlainText(input, options);

  if (!result.ok) {
    throw new Error(result.message);
  }

  return result.value;
}

export function containsDangerousHtml(input: string): boolean {
  const scanText = decodeBasicHtmlEntities(input).normalize("NFKC");

  return DANGEROUS_HTML_PATTERNS.some((pattern) => pattern.test(scanText));
}

export function safePlainTextFallback(
  input: string,
  fallback: string,
  options: PlainTextValidationOptions = {}
): string {
  const result = validatePlainText(input, options);

  return result.ok ? result.value : fallback;
}

function decodeBasicHtmlEntities(input: string): string {
  return input
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#34;/g, "\"")
    .replace(/&#x22;/gi, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&colon;/gi, ":");
}
