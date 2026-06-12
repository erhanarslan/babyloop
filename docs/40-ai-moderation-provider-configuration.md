# 40 — AI Moderation Provider Configuration

## Current scope

BabyLoop supports a redacted moderation summary workflow for backoffice Trust & Safety triage.

This iteration adds provider configuration and guardrails:

- local/default `mock` provider remains the default
- optional `openai` provider can be enabled with server-side environment variables
- OpenAI calls use the Responses API with structured JSON output
- request input is redacted before provider execution
- provider output is normalized and checked before it is returned, persisted, or audited
- `ai_model_runs` stores provider/model/prompt/run metadata without tokens, cookies, reporter identity, phone numbers, raw message bodies, or raw generation reasons

## Environment

Default local/dev behavior:

```env
AI_MODERATION_SUMMARY_PROVIDER=mock
```

OpenAI-backed moderation summaries:

```env
AI_MODERATION_SUMMARY_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODERATION_SUMMARY_MODEL=<configured server-side model>
OPENAI_RESPONSES_ENDPOINT=https://api.openai.com/v1/responses
```

`OPENAI_MODERATION_SUMMARY_MODEL` is intentionally required when the provider is set to `openai`; the code does not silently choose a production model.

## Privacy boundary

The AI summary workflow must use only redacted moderation case context:

Allowed input examples:

- moderation case id
- target type/id
- case status/priority
- safe report reason preview
- listing title/status preview
- profile display name and safety status
- message body preview generated through the redaction service
- recent timeline labels
- previous enforcement action names

Disallowed input/output examples:

- reporter email
- seller/user/profile email
- phone numbers
- raw message body
- raw sensitive-access result
- password hashes
- access/refresh tokens
- cookies
- raw admin generation reason

## OpenAI API usage

The OpenAI provider sends a non-stored structured response request to the configured Responses endpoint and requests a strict JSON object with:

- summary
- riskLevel
- recommendedAction
- rationale
- safetySignals
- confidenceScore

The API request uses a server-side key only. No OpenAI key is exposed to `apps/web` or `apps/backoffice`.

## Guardrails

The guardrails are deliberately conservative:

- email-like text is rejected
- phone-like text is rejected
- token/password/cookie/raw-sensitive wording is rejected
- unsafe keys such as `email`, `phone`, `token`, `cookie`, and `raw*` are rejected
- output text is length-limited and normalized
- output enum fields are constrained

If a real provider returns unsafe output, the route returns `AI_UNAVAILABLE` and logs an error `ai_model_runs` row without exposing the unsafe content in audit metadata.

## Deferred

- persistent AI summary history UI
- provider retry/backoff policy
- per-admin/case AI rate limiting
- cost dashboard
- prompt version management UI
- evaluation dataset and regression scoring
- image scanning
- model-specific monitoring
