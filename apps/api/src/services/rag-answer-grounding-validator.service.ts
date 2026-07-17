import type { RagDomainDecision } from "./rag-domain-router.service.js";
import type { RagCitation } from "./rag.types.js";

export type RagAnswerGroundingValidationResult = {
  allowed: boolean;
  status: "grounded" | "insufficient_sources" | "cross_domain_contamination" | "unsupported_claims";
  rejectedReasons: string[];
};

const FORBIDDEN_BY_DOMAIN: Record<string, RegExp[]> = {
  feeding: [
    /\bmontessori\b/iu,
    /\boyuncak\b/iu,
    /\bilan\b/iu,
    /\bkategori\b/iu,
    /sat[ıi]n\s+al/iu,
    /haftal[ıi]k\s+men[üu]/iu,
    /\b(?:gram|ml|mg|doz)\b/iu
  ]
};

export function validateRagAnswerGrounding(input: {
  answer: string;
  citations: RagCitation[];
  domainDecision: RagDomainDecision;
}): RagAnswerGroundingValidationResult {
  const rejectedReasons: string[] = [];

  if (input.domainDecision.requireCanonicalOwner) {
    const canonicalSourcePath = input.domainDecision.allowedSourcePaths[0];
    const hasOwner = input.citations.some((citation) =>
      citation.answerOwner === input.domainDecision.canonicalOwner ||
      citation.sourcePath === canonicalSourcePath
    );

    if (!hasOwner) {
      rejectedReasons.push("canonical_owner_missing");
    }
  }

  for (const citation of input.citations) {
    if (input.domainDecision.forbiddenTopics.includes(citation.topic ?? "")) {
      rejectedReasons.push("forbidden_source_topic");
    }
  }

  const forbiddenPatterns = FORBIDDEN_BY_DOMAIN[input.domainDecision.domain] ?? [];

  if (forbiddenPatterns.some((pattern) => pattern.test(input.answer))) {
    rejectedReasons.push("forbidden_domain_vocabulary");
  }

  const allowed = rejectedReasons.length === 0;

  return {
    allowed,
    status: allowed
      ? "grounded"
      : rejectedReasons.includes("forbidden_source_topic") || rejectedReasons.includes("forbidden_domain_vocabulary")
        ? "cross_domain_contamination"
        : rejectedReasons.includes("canonical_owner_missing")
          ? "insufficient_sources"
          : "unsupported_claims",
    rejectedReasons
  };
}
