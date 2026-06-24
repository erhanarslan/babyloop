# Backoffice Monitoring Dashboard Upgrade

## Scope

This increment upgrades the backoffice dashboard from a basic marketplace summary into an aggregate Trust & Safety monitoring view.

The dashboard remains privacy-safe. It exposes operational counts only and must not expose:

- user email addresses
- phone/contact data
- reporter identity
- raw report details
- raw message bodies
- sensitive-access result payloads
- raw AI input/output payloads

## API

Endpoint:

```txt
GET /api/v1/admin/dashboard/summary
```

The endpoint now returns aggregate sections for:

- listings
- listing images
- moderation/report queue
- admin actions
- profile risk queue
- conversations/messages
- AI moderation summary health

## Added monitoring signals

### Moderation queue

- open high-priority cases
- open normal-priority cases
- open low-priority cases
- pending report count
- reports created in the last 7 days

### Profile risk queue

- restricted profiles
- suspended profiles
- high-risk profiles
- critical-risk profiles
- combined `profilesNeedingReview` count

### Message safety

- total conversations
- conversations created in the last 7 days
- messages created in the last 7 days
- reported message count
- open message case count
- message enforcement actions in the last 7 days

### AI moderation health

- moderation summary runs in the last 7 days
- moderation summary failures in the last 7 days
- provider failures in the last 7 days
- validation failures in the last 7 days

## Backoffice UI

The dashboard now surfaces operational modules for:

- Moderation queue
- Profile risk queue
- Message safety
- Marketplace review
- Image review
- Audit and sensitive access
- AI moderation health

Each module links to the relevant active backoffice area when available.

## Privacy model

The dashboard is intentionally aggregate-only.

Conversation and message metrics must use counts only. Message body content is not returned.

AI health metrics must use run counts and failure counts only. Raw model input/output, provider error bodies, report reasons, and generated summaries are not returned by this endpoint.

## Validation

Run:

```bash
pnpm --filter @babyloop/api exec vitest run test/admin-dashboard.schemas.test.ts --config vitest.config.ts
pnpm --filter @babyloop/api typecheck
pnpm --filter @babyloop/backoffice typecheck
```

Recommended regression:

```bash
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test \
  pnpm --filter @babyloop/api exec vitest run test/admin-moderation.integration.test.ts --config vitest.config.ts
```

Security grep:

```bash
grep -R "seller.email\|profile.email\|user.email\|phone\|message.body\|reporter.email\|refreshToken\|accessToken\|passwordHash\|console.log\|localStorage\|sessionStorage\|document.cookie\|rawReason\|reasonText" -n \
  apps/api/src \
  apps/backoffice/src \
  | sort
```

Expected hits remain limited to auth internals, explicit sensitive-access flows, and explanatory UI copy. Dashboard code must not add sensitive payload exposure.

## Deferred work

- A dedicated AI Ops page with run-level safe DTOs.
- Dedicated Safety Events page.
- SLA/assignment queue widgets.
- Time-series charts.
- Export/reporting flows.
