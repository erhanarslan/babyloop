# AI Audit Logging Plan

## Why AI Logs Are Needed

BabyLoop AI features must be safe, auditable, and explainable. AI logs help the team debug bad outputs, compare prompt versions, review provider behavior, measure confidence, and support human-in-the-loop decisions later.

AI logs should never make core marketplace actions depend on AI. Manual listing creation must keep working if AI logging fails.

## Minimal Table: `ai_model_runs`

The first implemented database slice adds one small table:

| Column | Purpose |
| --- | --- |
| `id` | Run id. |
| `feature` | Example: `listing_suggestion`. |
| `provider_name` | Example: `mock-listing-suggestion`. |
| `model_name` | Nullable, currently `mock-model` for mock suggestion logs. |
| `prompt_version` | Prompt/version used for the run. |
| `input` | Sanitized task input JSON. |
| `output` | Validated AI output JSON, when available. |
| `confidence_score` | Nullable numeric confidence. |
| `risk_score` | Nullable numeric risk score for future moderation/risk uses. |
| `status` | Current endpoint uses `success` or `error`; enum also allows future statuses. |
| `error_message` | Safe short message, no stack trace. |
| `created_at` | Timestamp. |

Entity references, latency, token usage, cost, and retrieved context ids are intentionally delayed until a feature needs them.

## What To Log

- task type
- sanitized input fields
- validated output
- provider and model metadata
- prompt version
- status and safe error details
- confidence score when available
- related entity reference when available

## What Not To Log

- raw passwords, tokens, cookies, API keys
- unnecessary private user data
- raw uploaded image binaries
- full private messages in early phases
- stack traces in user-facing or broad admin-visible logs
- unbounded prompt/context text

## Privacy Notes

Store the smallest useful snapshot. Prefer ids and references over duplicated content. Logs should be append-only. Later deletion/retention rules should handle privacy requests without silently rewriting AI decision history.

## Prompt Version

Every run should include a prompt version such as:

```text
listing_suggestion.mock.v1
```

Prompt updates should create new versions instead of overwriting previous behavior.

## Provider and Model Metadata

Mock runs should record:

- `provider_name`: `mock-listing-suggestion`
- `model_name`: `mock-model`

Real provider runs later should record provider, model, token usage, and cost metadata where available.

## Status and Error Handling

AI logging failures should not block the original user flow. For the first slice, API can return the suggestion even if log insertion fails, while safely logging the logging error to server logs.

Use safe statuses:

- `success`
- `error`
- `validation_failed`
- `provider_failed`
- `skipped`

## First Use Case: `listing_suggestion`

Log the mock listing suggestion endpoint:

```http
POST /api/v1/ai/listing-suggestions
```

The log should capture draft title, description, category name, condition, validated suggestion output, provider name, prompt version, confidence, and status.

## Future Uses

- Pricing: valuation ranges, confidence, comparable listing ids.
- RAG: question, answer, retrieved context ids, prompt version.
- Moderation: risk score, reason codes, recommended action, human override status.
