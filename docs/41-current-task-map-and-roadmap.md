# 41 — Current Task Map And Roadmap

## Purpose

This document is the current operating map for BabyLoop after the backoffice Trust & Safety and AI moderation provider milestones.

It separates what is implemented, what is partially implemented, and what should be built next. It also records the intended sequence so future work does not scatter AI, trust scoring, marketplace operations, and public listing assistance across unrelated patches.

## Current Commit Baseline

Current confirmed baseline:

```txt
239a0c2 feat(ai): add moderation provider configuration and guardrails
71780ca feat(ai): add redacted moderation summary foundation
d6c1816 feat(trust-safety): add profile enforcement and audit browser
74b9ae5 fix(backoffice): stabilize marketplace review operations
e6766c9 fix(auth): harden backoffice session storage
```

## Implemented Product Areas

### Public marketplace web

Implemented:

- home, browse, listing detail, sell, favorites, my listings, notifications, conversations, and auth pages
- manual listing creation/edit/lifecycle
- local image upload with preview on sell flow
- favorites and privacy-safe favorite count
- messaging list/thread/composer
- notifications center and unread badge
- report/block entry points
- mock listing text suggestion panel on `/sell`

Not yet implemented:

- advanced search filters and pagination
- saved search
- seller analytics dashboard
- production image pipeline
- public listing AI image understanding
- price valuation and comparable market research
- reviews/ratings
- payments/rental flow
- web E2E/component test coverage

### API and data model

Implemented:

- Fastify API with `/api/v1` prefix
- PostgreSQL/Drizzle schema and migrations
- auth/session/password reset/email verification/Google OAuth foundation
- listing/favorite/notification/messaging/safety APIs
- local upload serving and image safety validation
- moderation cases/actions/events
- profile safety status enforcement
- safe audit browser API
- AI model run logging

Not yet implemented:

- production email provider
- public web cookie session migration
- full CSRF token enforcement
- session/device management UI
- granular admin RBAC
- production observability and deployment hardening

### Dedicated backoffice

Implemented:

- separate `apps/backoffice` app
- cookie-backed admin auth, no browser-readable access token storage
- dashboard aggregate MVP
- moderation list/detail/timeline/status/action forms
- permissioned sensitive-access panel with audit
- listing review list/detail
- listing archive/restore and image approve/reject actions
- profile enforcement controls
- safe audit event browser
- explicit redacted AI moderation summary generation panel

Not yet implemented:

- case assignment and SLA workflow
- profile/user directory and profile detail page
- monitoring/case analytics page
- trust/risk score snapshots
- appeal/export flow
- AI summary history and rate limiting
- cost/usage dashboard for AI
- backoffice E2E/component tests

### AI foundation

Implemented:

- deterministic mock public listing suggestion provider
- redacted backoffice moderation summary foundation
- configurable moderation summary provider: `mock` or server-side `openai`
- OpenAI Responses API structured JSON output adapter for moderation summaries
- redacted input and safe output guardrails
- `ai_model_runs` persistence for moderation summaries
- safe audit metadata for AI moderation events

Not yet implemented:

- AI moderation summary history/read UI
- per-admin/per-case AI generation rate limits
- AI provider retry/backoff/circuit breaker
- token/cost/latency metrics
- evaluation dataset and regression scoring
- public listing image understanding
- brand/model/category inference
- condition estimation
- price valuation and comparable market research
- RAG/recommendations

## Strategic Direction

BabyLoop is moving from a simple marketplace into three connected systems:

```txt
1. Safe marketplace foundation
2. Backoffice Trust & Safety intelligence
3. AI-assisted listing creation and valuation
```

The correct order is:

1. Finish backoffice intelligence and monitoring.
2. Add trust/risk score snapshots.
3. Add public listing AI image assistant.
4. Add pricing/market research and recommendation intelligence.
5. Harden production auth, image, email, observability, and tests before production rollout.

## Next Recommended Task Sequence

### P0 — Stabilize AI moderation operations

#### 1. AI moderation summary history and rate limiting

Goal:

- show recent AI summary runs on moderation case detail
- prevent repeated generation spam for the same case/admin in a short window
- expose safe AI run metadata without raw input/output leaks

Suggested scope:

- `GET /api/v1/admin/moderation/cases/:caseId/ai-summaries`
- safe DTO from `ai_model_runs`
- server-side per-case cooldown, for example 60 seconds initially
- backoffice history list in the AI panel
- docs/tests

Do not expose:

- raw sensitive-access data
- reporter email
- raw message bodies
- provider API keys
- raw admin generation reason

#### 2. Case insights panel

Goal:

- reduce admin cognitive load by showing safe decision-support metrics in moderation case detail

Suggested signals:

- target profile safety status
- report count against target in last 7/30 days
- open case count for target
- prior enforcement count
- AI summaries generated for this case
- recent sensitive-access count for this case
- suggested risk band from rules only, not destructive automation

Output should be advisory and safe-only.

### P1 — Trust/risk score snapshots

#### 3. Profile risk/trust snapshot model

Goal:

- compute an internal score for admin prioritization, not a public user rating

Suggested table:

```txt
profile_trust_snapshots
- id
- profile_id
- trust_score 0-100
- risk_score 0-100
- risk_level low|medium|high|critical
- open_case_count
- recent_report_count_7d
- recent_report_count_30d
- recent_enforcement_count_30d
- restricted_or_suspended
- last_report_at
- last_enforcement_at
- computed_at
```

Important boundary:

- never show trust score publicly
- never use it as the only basis for destructive action
- always keep admin/human review in enforcement flows

#### 4. Monitoring and reporting dashboard

Goal:

- give admins operational visibility beyond aggregate dashboard cards

Suggested route:

```txt
/backoffice/monitoring
GET /api/v1/admin/monitoring/summary
```

Suggested metrics:

- open cases by priority/status
- cases created/resolved last 7/30 days
- repeated reporters/targets as aggregate counts only
- profile restriction/suspension trend
- AI run success/error counts
- AI risk-level distribution
- image review queue counts

Keep it aggregate by default. No raw identities unless linking into existing safe detail pages.

### P2 — Public AI listing assistant

#### 5. Listing image understanding foundation

Goal:

- when a seller uploads product photos, generate safe suggestions for category, brand/model hints, condition, and missing questions

Suggested flow:

- seller selects image locally
- explicit “Analyze photos” button
- API receives uploaded or temporary image reference
- provider returns structured suggestions
- user can accept/edit/ignore suggestions
- no automatic publish or destructive mutation

Initial output:

```txt
categorySuggestion
brandGuess
modelGuess
conditionGuess
confidenceScore
missingInfoQuestions
safetyWarnings
```

#### 6. Price valuation and comparable market research

Goal:

- suggest an estimated price range, not a guaranteed value

Suggested input:

- category
- brand/model if known
- condition
- listing title/description
- historical/comparable BabyLoop listings when available
- optional external market research later

Output:

```txt
recommendedPrice
priceRangeLow
priceRangeHigh
confidenceScore
reasoning
missingInfo
marketSignals
```

Important boundary:

- never claim a guaranteed sale price
- show uncertainty and missing info
- require seller confirmation before applying price

### P3 — Production hardening

- public web cookie migration
- full CSRF token enforcement
- granular RBAC
- production email provider
- object storage/CDN/EXIF stripping/image transforms
- Redis-backed realtime scaling
- observability/logging/metrics
- web E2E tests
- backoffice E2E/component tests

## Current Prioritized Task List

| Priority | Task | Status | Notes |
| --- | --- | --- | --- |
| P0 | AI summary history + rate limiting | Next | Needed before real provider usage becomes noisy/costly. |
| P0 | Case insights panel | Next | Admin decision-support without new destructive automation. |
| P1 | Profile trust/risk snapshots | Planned | Internal-only score for prioritization. |
| P1 | Monitoring dashboard | Planned | Aggregates for moderation, AI, profile enforcement, image review. |
| P1 | Public web auth cookie migration + CSRF | Planned | Required before production. |
| P1 | Production image pipeline | Planned | R2/S3, transforms, EXIF stripping, CDN/cache, rate limits. |
| P2 | Listing image AI assistant | Planned | Brand/model/category/condition suggestions. |
| P2 | Price valuation + comparable research | Planned | Start with internal comparable data; external research later. |
| P2 | Search filters/pagination/saved search | Planned | Marketplace growth feature. |
| P3 | Payments/rental/reviews/mobile | Deferred | Product expansion after core trust and AI foundation. |

## Documentation Rule Going Forward

Every implementation patch should update at least one of:

- `docs/21-current-implementation-state.md`
- `docs/29-current-backlog-and-next-steps.md`
- a feature-specific doc, for example `docs/40-ai-moderation-provider-configuration.md`
- this roadmap document

If a feature changes API privacy boundaries, update:

- `docs/22-api-contract-rules.md`
- `docs/32-backoffice-data-privacy-and-redaction.md`

If a feature changes validation, update:

- `docs/25-validation-and-regression-checklist.md`
