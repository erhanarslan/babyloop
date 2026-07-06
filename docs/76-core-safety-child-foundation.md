# Core Safety Hardening + Child Notebook/Reminder Foundation

This release gate covers backlog items #169-#203 as a single safety and child-foundation pass. Codex did not run tests in this task; the commands at the end of this document must be run locally.

## Scope Status

Implemented foundations:

- #169 Public DTO no-leak global guard inventory.
- #170 Admin DTO redaction global guard inventory.
- #171 Sensitive access audit consistency guard inventory.
- #172 Auth token/cookie/log leak static guard expansion.
- #173 CSRF protected mutation endpoint inventory.
- #174 Rate limit coverage inventory.
- #175 XSS/plaintext validation inventory.
- #176 SQLi-safe query/filter audit inventory.
- #177 File upload size/mime/magic-byte negative case inventory.
- #178 Block/report/moderation abuse-flow E2E inventory.
- #179 Profile restricted/suspended behavior cross-feature inventory.
- #180 Notification metadata PII no-leak guard.
- #181 RAG/AI prompt input PII redaction boundary inventory.
- #182 RAG medical/therapy/diagnosis refusal guard inventory.
- #183 AI provider unavailable/fail-closed aggregate inventory.
- #184 Child notebook notes API implementation.
- #185 Child notebook reminders API implementation.
- #186 Reminder due-candidate service DB path.
- #187 Reminder notification draft generation.
- #188 Reminder notification delivery log integration.
- #189 Reminder frequency/dedup/idempotency tests.
- #190 Child reminders web UI surface.
- #191 Child reminders mobile UI/model surface.
- #192 Child notebook web/mobile empty/loading/error state inventory.
- #193 Notification preference per source/channel readiness policy.
- #194 Notification preference audit trail readiness policy.
- #195 Saved-search notification candidate matching.
- #196 Saved-search notification dedup/frequency guard.
- #197 Child lifecycle recommendation notification cadence.

Explicitly deferred or readiness-only:

- #198 Notification delivery provider design gate sonrası sandbox: provider send remains disabled.
- #199 Email draft/provider adapter boundary: email is draft/readiness-only; no sender is enabled.
- #200 Push token registry design gate: no push token collection is enabled.
- #201 Push readiness real mobile integration hazırlığı: readiness only; no native push integration is enabled.
- #202 n8n webhook contract design: no webhook secret or outbound webhook is enabled.
- #203 n8n sandbox workflow boundary: sandbox/readiness only; no n8n worker is enabled.

Real-device items #137 and #159 remain deferred until Galaxy S22/Maestro evidence is recorded.

## Child Notebook And Reminders

Child notes and reminders are implemented under `/api/v1/child-profiles/:childProfileId/notes` and `/api/v1/child-profiles/:childProfileId/reminders`. They use owner authorization, strict plaintext validation, maximum lengths, safe DTOs, and archive/cancel/complete style lifecycle actions. Responses must not expose parent email, phone, tokens, password hashes, provider secrets, raw message bodies, or internal user identifiers.

Reminder delivery candidate generation is DB-backed and draft-only. Candidate logs use idempotency keys and frequency windows. `deliveryAllowed=false` and `draftOnly=true` are required for reminder and saved-search notification candidates unless a future provider design gate explicitly changes that behavior.

Notification source/channel policy is readiness-only for `child_reminder`, `saved_search`, `child_lifecycle`, `marketing`, and `security`. Channels are inventoried as `email`, `push`, `in_app`, and `n8n`, but provider calls remain disabled by default.

## No-Leak Checklist

The release guard checks for these boundaries:

- Public DTOs do not expose `accessToken`, `refreshToken`, `passwordHash`, cookies, authorization headers, OTP values, provider secrets, webhook secrets, raw emails, raw phone numbers, or raw message bodies.
- Admin default DTOs are redacted. Sensitive access requires reason, requested fields, admin identity, and audit visibility.
- Notification metadata sanitization drops or redacts email, phone, token, password, cookie, authorization, OTP, secret, raw body, and message-body-like keys.
- Mobile token storage remains SecureStore-based. AsyncStorage, localStorage, sessionStorage, and document.cookie token persistence are forbidden.
- Public report/block actions stay behind the safety menu pattern.
- Plaintext validation rejects script/HTML/control-character abuse in child notes/reminders and related user-generated text.
- RAG/AI keeps PII redaction, medical/therapy/diagnosis/medicine/diet refusal, and provider-unavailable fail-closed boundaries.

## Provider / Queue / External Delivery Checklist

No real provider is enabled in this package:

- No email sender.
- No push sender or push token registry.
- No n8n webhook invocation.
- No queue worker.
- No RAG/AI provider activation beyond existing safety boundaries.
- No provider secret, webhook secret, or outbound delivery URL is introduced.

## Local Commands

Run these locally after reviewing the diff:

```bash
pnpm security:core-safety-child-foundation
pnpm release:mobile:p0
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test pnpm test:api:security
pnpm beta:critical-smoke
```

Optional targeted API checks:

```bash
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test pnpm --filter @babyloop/api exec vitest run --config vitest.config.ts test/child-profile-notes-reminders.routes.test.ts test/child-profile-notes-reminders.schemas.test.ts test/child-reminder-delivery-candidates.service.test.ts test/notification-delivery-log.service.test.ts test/saved-search-delivery-candidates.service.test.ts
```
