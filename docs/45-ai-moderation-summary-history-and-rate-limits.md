# AI Moderation Summary History and Rate Limits

## Purpose

This document records the moderation AI follow-up work after the initial redacted
summary provider and guardrail implementation.

The goal is to make backoffice AI useful for actual moderation operations without
turning it into an unbounded generate button.

## Implemented behavior

- Admins can list recent AI moderation summary runs for a moderation case.
- The backoffice moderation detail panel shows recent safe AI run history.
- A successful recent run prevents another generation for the same case for a short cooldown window.
- The rate limit is case-scoped and based on successful `ai_model_runs` rows.
- Provider, model, prompt version, risk level, recommended action, confidence score, and safe summary preview are displayed.
- Raw input, raw report text, reporter identity, raw message body, tokens, cookies, and raw reasons are not exposed in the history UI.

## API

### GET `/api/v1/admin/moderation/cases/:caseId/ai-summaries`

Returns recent safe AI summary runs for a moderation case.

Query:

- `limit`: optional, 1-20, default 5

Response data:

- `caseId`
- `summaries[]`
  - `id`
  - `status`
  - `providerName`
  - `modelName`
  - `promptVersion`
  - `summary`
  - `riskLevel`
  - `recommendedAction`
  - `confidenceScore`
  - `riskScore`
  - `errorMessage`
  - `createdAt`

### POST `/api/v1/admin/moderation/cases/:caseId/ai-summary`

Still requires an explicit reason and redacted input. If a successful summary was
generated recently for the same case, the endpoint returns `429 AI_RATE_LIMITED`.

## Privacy boundaries

The history endpoint reads from `ai_model_runs`, but it returns only an allowlisted
safe projection.

Do not expose:

- raw AI input,
- raw AI output object,
- reporter email,
- user email,
- phone,
- raw message body,
- raw report reason,
- tokens,
- cookies,
- password hashes,
- sensitive-access result payloads.

## Deferred

- configurable cooldown from environment,
- admin override for high-priority cases,
- per-admin/provider cost budgets,
- AI summary comparison view,
- case insight scoring,
- profile trust/risk snapshots,
- monitoring dashboard for AI usage and provider cost.
