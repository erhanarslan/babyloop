# 53 - AI Ops Mini Panel

## Status

Implemented.

## Scope

Adds a privacy-safe AI operations panel for backoffice Trust and Safety workflows.

## API

- `GET /api/v1/admin/ai-ops/summary`
- `GET /api/v1/admin/ai-ops/runs`

The summary endpoint returns aggregate operational metrics for AI model runs:

- total runs
- runs in the last 24 hours
- runs in the last 7 days
- success/failure counts
- provider failure count
- validation failure count
- skipped count
- status breakdown
- provider/model breakdown
- recent safe run summaries

The runs endpoint supports safe operational filters:

- `feature`
- `providerName`
- `status`
- `q`
- `sort`
- `limit`

## Backoffice

Adds `/ai-ops`.

The page shows:

- aggregate AI health cards
- status breakdown
- provider/model breakdown
- recent safe AI runs
- links to related moderation cases when a case id is available

## Privacy boundaries

The AI Ops panel does not expose:

- raw AI input
- raw AI output
- raw prompts
- raw message bodies
- reporter identity
- email addresses
- phone/contact data
- sensitive-access payloads

The page only displays operational metadata such as provider, model, prompt version, status, score fields, safe error previews, and related case id.

## Notes

`errorSummary` is redacted and truncated through the shared private-text redaction helper.

The page is operational visibility only. It does not retry runs, regenerate summaries, edit provider configuration, or expose raw model payloads.

## Validation

Run:

```bash
pnpm --filter @babyloop/api exec vitest run test/admin-ai-ops.schemas.test.ts --config vitest.config.ts
pnpm --filter @babyloop/api typecheck
pnpm --filter @babyloop/backoffice typecheck
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test pnpm --filter @babyloop/api exec vitest run test/admin-moderation.integration.test.ts --config vitest.config.ts
git diff --check
```

Privacy grep:

```bash
grep -R "seller.email\|profile.email\|user.email\|phone\|message.body\|reporter.email\|refreshToken\|accessToken\|passwordHash\|console.log\|localStorage\|sessionStorage\|document.cookie\|rawReason\|reasonText" -n apps/api/src apps/backoffice/src | sort
```

Expected hits remain limited to auth internals, explicit sensitive-access UI/service, and explanatory UI copy.
