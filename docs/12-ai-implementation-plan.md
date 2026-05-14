# AI Implementation Plan

## Scope

This plan defines the first AI implementation path for BabyLoop. It should guide small, testable slices without adding AI features before the marketplace foundation is stable.

Core rule: AI must assist listing creation, not block it. A seller should still be able to create a manual listing when AI is unavailable, slow, low-confidence, or returns invalid output.

## AI Phases

| Phase | Name | Goal | Done criteria |
| --- | --- | --- | --- |
| 1 | Mock listing suggestion | Add an AI-shaped workflow without external model cost or latency. | Mock provider returns deterministic title, description, tags, missing fields, and warnings. Output is validated and logged. |
| 2 | Real provider | Replace mock-only execution with an OpenAI-compatible provider behind the same interface. | Provider can be enabled by env var; mock remains available for tests/local fallback. |
| 3 | Price estimate | Suggest second-hand price range from listing metadata and comparable listings. | Structured valuation output includes range, recommended price, confidence, reasoning, and missing info. |
| 4 | RAG | Answer parent/product questions from approved BabyLoop knowledge sources. | Retrieved context ids are logged; answers include uncertainty and source boundaries. |
| 5 | Moderation | Score listing/message risk and recommend safe actions. | AI can warn or queue for review, but high-impact actions stay human-reviewable. |
| 6 | Recommendation | Recommend listings/categories from behavior and child-stage signals. | Recommendations are explainable, auditable, and exclude unsafe/hidden/sold listings. |

## Provider Strategy

Start with a mock provider because it makes the workflow testable before introducing external dependencies, cost, network failures, model variance, or secret management.

Later, add a real OpenAI-compatible provider behind the same interface:

- `AI_PROVIDER=mock` for local and tests
- `AI_PROVIDER=openai-compatible` for real model calls
- provider-specific model/base URL/API key env vars only when real provider is introduced

Application features should call BabyLoop AI services, not provider SDKs directly.

## Token-Saving Strategy

- Send only fields needed for the task.
- Prefer compact structured inputs over long natural-language context.
- Use category ids/names and normalized attributes instead of full database records.
- Truncate seller text with clear limits.
- Retrieve only top relevant RAG chunks.
- Log large context by ids where possible instead of duplicating full content.
- Cache deterministic mock outputs and later consider caching embeddings/RAG retrieval where safe.

## Structured Outputs and Validation

Every AI task should define:

- task name
- input schema
- output schema
- prompt version
- provider/model metadata
- fallback behavior

Use Zod to validate model outputs before any UI or database update consumes them. Invalid output should become a safe failed AI task, not a broken listing flow.

## Prompt Versions

Prompts should be versioned before production model calls:

| Field | Purpose |
| --- | --- |
| promptKey | Stable key such as `listing_suggestion`. |
| version | Numeric or semantic version. |
| status | Draft, staging, production, archived. |
| schemaName | Expected structured output schema. |
| template | Prompt content with explicit variables. |
| safetyNotes | Task-specific constraints and refusals. |

Production tasks should reference a production prompt version. Prompt edits should create new versions, not overwrite history.

## AI Audit Logging

AI task logs should be append-only and privacy-aware.

Minimum log fields:

- task type
- entity type and id
- input snapshot or safe input reference
- output snapshot
- provider and model
- prompt key and version
- validation status
- confidence score when applicable
- risk score when applicable
- fallback used flag
- latency, token usage, and cost when available
- human override status later
- created_at

Do not store unnecessary personal data. Reference files/media by id instead of copying binary content.

## Fallback Behavior

AI failures should return controlled states:

| Failure | Behavior |
| --- | --- |
| Provider unavailable | Continue manual flow; show non-blocking message. |
| Timeout | Continue manual flow; log timeout. |
| Invalid structured output | Discard AI result; log validation failure. |
| Low confidence | Show missing information checklist instead of strong recommendation. |
| Safety-sensitive category | Show warnings and questions, never safety guarantees. |

## Why AI Must Not Block Listing Creation

Listing creation is the core marketplace action. Blocking it on AI would make local development brittle, increase production failure impact, and create poor UX when providers are slow or unavailable.

AI should improve quality after or alongside manual input:

1. seller creates or edits listing manually
2. AI suggestion runs as optional assistance
3. seller accepts, edits, or ignores AI output
4. system logs the AI task and any later human decision

This keeps BabyLoop reliable while still demonstrating production-grade AI architecture.
