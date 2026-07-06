# Message Conversation Admin Review

## Scope

This increment adds a privacy-safe backoffice conversation review surface for Trust & Safety operations.

Implemented:

- `GET /api/v1/admin/conversations`
- `GET /api/v1/admin/conversations/:conversationId`
- Backoffice `/conversations`
- Backoffice `/conversations/[conversationId]`
- Active sidebar navigation for Messages
- Redacted message previews
- Participant safety summaries
- Listing context summary
- Message report, open case, and enforcement counts
- Related message moderation cases
- Message enforcement history

## Privacy boundaries

The admin conversation review intentionally does not expose:

- User email addresses
- Phone/contact values
- Reporter identity
- Raw report details
- Raw message body fields
- Raw AI input/output payloads
- Sensitive-access payloads

Message text is projected only as a short redacted preview. Contact-like values are replaced before the preview is returned.

## Operational model

This view is read-only. Enforcement remains routed through moderation cases for this increment. Admins can use related case links to apply existing message actions such as `message_hide` and `message_mark_reviewed`.

Deferred:

- Direct message action form on conversation detail
- Sensitive-access request integration from conversation detail
- Conversation-level blocking controls
- Conversation search by listing title
- Pagination cursor support beyond bounded `limit`

## Validation

Run:

```bash
pnpm --filter @babyloop/api exec vitest run test/admin-conversations.schemas.test.ts --config vitest.config.ts
pnpm --filter @babyloop/api typecheck
pnpm --filter @babyloop/backoffice typecheck
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test pnpm --filter @babyloop/api exec vitest run test/admin-moderation.integration.test.ts --config vitest.config.ts
git diff --check
```

Privacy grep should show no new DTO leaks for email, raw message bodies, reporter identity, raw report details, or raw AI payloads.

## Messaging safety full-flow boundary

Message conversation admin review must pass pnpm security:messaging-safety-full-flow.

The boundary confirms default bodyPreview redaction, safe participant summaries, related moderation case counts, enforcement history, and sensitive-access audit requirements. It does not expose email, phone, accessToken, refreshToken, cookie, authorization, passwordHash, raw message body, or raw auth/session data by default.

Unsafe message bodies are rejected before persistence and realtime publish. This does not add a new realtime provider.

Messaging safety full-flow boundary does not expose email, does not expose phone, does not expose accessToken, does not expose refreshToken, does not expose cookie, and does not expose authorization in public, realtime, or admin default DTOs.
