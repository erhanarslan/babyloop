import { mockModerationSummaryProvider } from "./mock-moderation-summary-provider.js";
import type {
  ModerationSummaryGuardrailIssue,
  ModerationSummaryInput,
  ModerationSummaryOutput,
  ModerationSummaryProvider
} from "./types.js";

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{7,}\d)/;
const UUID_VALUE_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;

const SAFE_IDENTIFIER_FIELD_PATTERN =
  /(?:^|\.)(?:caseId|targetId|listingId|imageId|profileId|aiModelRunId|moderationCaseId|moderationActionId)$/i;
const UNSAFE_LITERAL_PATTERNS = [
  /raw\s+message\s+body/i,
  /reporter\s+email/i,
  /user\s+email/i,
  /seller\s+email/i,
  /password\s*hash/i,
  /refresh\s*token/i,
  /access\s*token/i
];

const MAX_SUMMARY_LENGTH = 1000;
const MAX_RATIONALE_ITEMS = 8;
const MAX_SAFETY_SIGNAL_ITEMS = 12;
const MAX_ITEM_LENGTH = 240;

export async function summarizeModerationCase(
  input: ModerationSummaryInput,
  options: {
    provider?: ModerationSummaryProvider;
    enforceRedaction?: boolean;
  } = {}
): Promise<ModerationSummaryOutput> {
  const enforceRedaction = options.enforceRedaction ?? true;

  if (enforceRedaction) {
    assertRedactedModerationSummaryInput(input);
  }

  const provider = options.provider ?? mockModerationSummaryProvider;
  const output = await provider.summarizeModerationCase(input);
  const normalizedOutput = normalizeModerationSummaryOutput(output, provider);

  if (enforceRedaction) {
    assertSafeModerationSummaryOutput(normalizedOutput);
  }

  return normalizedOutput;
}

export function validateRedactedModerationSummaryInput(
  input: ModerationSummaryInput
): ModerationSummaryGuardrailIssue[] {
  const issues: ModerationSummaryGuardrailIssue[] = [];

  inspectValue("input", input, issues);

  return issues;
}

export function assertRedactedModerationSummaryInput(input: ModerationSummaryInput): void {
  const issues = validateRedactedModerationSummaryInput(input);

  if (issues.length > 0) {
    throw new Error(`Moderation summary input failed redaction guardrails: ${formatIssues(issues)}`);
  }
}

export function validateSafeModerationSummaryOutput(
  output: ModerationSummaryOutput
): ModerationSummaryGuardrailIssue[] {
  const issues: ModerationSummaryGuardrailIssue[] = [];

  inspectValue("output", output, issues);

  return issues;
}

export function assertSafeModerationSummaryOutput(output: ModerationSummaryOutput): void {
  const issues = validateSafeModerationSummaryOutput(output);

  if (issues.length > 0) {
    throw new Error(`Moderation summary output failed safety guardrails: ${formatIssues(issues)}`);
  }
}

function normalizeModerationSummaryOutput(
  output: ModerationSummaryOutput,
  provider: ModerationSummaryProvider
): ModerationSummaryOutput {
  const normalized: ModerationSummaryOutput = {
    summary: clampString(output.summary, MAX_SUMMARY_LENGTH),
    riskLevel: normalizeRiskLevel(output.riskLevel),
    recommendedAction: normalizeRecommendedAction(output.recommendedAction),
    rationale: normalizeStringArray(output.rationale, MAX_RATIONALE_ITEMS),
    safetySignals: normalizeStringArray(output.safetySignals, MAX_SAFETY_SIGNAL_ITEMS),
    confidenceScore: normalizeConfidenceScore(output.confidenceScore),
    providerName: clampString(output.providerName || provider.providerName, 120),
    promptVersion: clampString(output.promptVersion, 160),
    ...(output.modelName || provider.modelName
      ? { modelName: clampString(output.modelName ?? provider.modelName ?? "", 160) }
      : {})
  };

  return normalized;
}

function normalizeRiskLevel(value: unknown): ModerationSummaryOutput["riskLevel"] {
  return value === "high" || value === "medium" || value === "low" ? value : "medium";
}

function normalizeRecommendedAction(
  value: unknown
): ModerationSummaryOutput["recommendedAction"] {
  if (
    value === "dismiss_or_monitor" ||
    value === "continue_review" ||
    value === "hide_listing" ||
    value === "hide_message" ||
    value === "restrict_profile" ||
    value === "escalate"
  ) {
    return value;
  }

  return "continue_review";
}

function normalizeConfidenceScore(value: unknown): number {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : 0.5;

  return Math.min(Math.max(Math.round(numeric * 100) / 100, 0), 1);
}

function normalizeStringArray(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => clampString(item, MAX_ITEM_LENGTH))
    .filter(Boolean)
    .slice(0, maxItems);
}

function clampString(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trimEnd()}…`;
}

function inspectValue(
  field: string,
  value: unknown,
  issues: ModerationSummaryGuardrailIssue[]
): void {
  if (typeof value === "string") {
    inspectString(field, value, issues);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectValue(`${field}[${index}]`, item, issues));
    return;
  }

  if (typeof value === "object" && value !== null) {
    for (const [key, nestedValue] of Object.entries(value)) {
      if (isUnsafeKey(key)) {
        issues.push({ field: `${field}.${key}`, reason: "unsafe key is not allowed" });
      }

      inspectValue(`${field}.${key}`, nestedValue, issues);
    }
  }
}

function inspectString(
  field: string,
  value: string,
  issues: ModerationSummaryGuardrailIssue[]
): void {
  if (EMAIL_PATTERN.test(value)) {
    issues.push({ field, reason: "contains an email-like value" });
  }

  const phoneCandidate = value
    .replace(UUID_VALUE_PATTERN, "")
    .replace(/\[redacted-phone\]/gi, "");

  if (
    shouldInspectPhoneLikeValue(field, phoneCandidate) &&
    PHONE_PATTERN.test(phoneCandidate)
  ) {
    issues.push({ field, reason: "contains a phone-like value" });
  }

  if (UNSAFE_LITERAL_PATTERNS.some((pattern) => pattern.test(value))) {
    issues.push({ field, reason: "contains unsafe sensitive-data wording" });
  }
}
function shouldInspectPhoneLikeValue(field: string, value: string): boolean {
  if (SAFE_IDENTIFIER_FIELD_PATTERN.test(field)) {
    return false;
  }

  return value.trim().length > 0;
}

function isUnsafeKey(key: string): boolean {
  return /email|phone|password|token|cookie|raw/i.test(key);
}

function formatIssues(issues: ModerationSummaryGuardrailIssue[]): string {
  return issues.map((issue) => `${issue.field}:${issue.reason}`).join(", ");
}
