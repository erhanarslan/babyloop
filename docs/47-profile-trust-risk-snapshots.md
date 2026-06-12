# Profile Trust and Risk Snapshots

## Purpose

Profile trust snapshots provide a persisted, privacy-safe signal for backoffice Trust & Safety workflows.
They are designed to help admins understand profile-level risk without exposing reporter identity,
raw messages, raw report details, raw AI prompts, or sensitive access payloads.

This is an internal decision-support signal. It must not be shown publicly and must not become an
automated punishment mechanism.

## Data Model

The `profile_trust_snapshots` table stores one snapshot per profile.

Fields include:

- `profile_id`
- `trust_score` from 0 to 100
- `risk_score` from 0 to 100
- `risk_level`: `low`, `medium`, `high`, `critical`
- `safety_status`: `active`, `restricted`, `suspended`
- open and total related case counts
- recent report count
- recent enforcement count
- sensitive access count
- AI summary count
- last report and enforcement timestamps
- `computed_at`

## Computation

Snapshots are computed from safe aggregate signals:

- profile-targeted reports and cases,
- listing-targeted reports/cases for listings owned by the profile,
- message-targeted reports/cases for messages sent by the profile,
- moderation enforcement action counts,
- sensitive access event counts,
- AI moderation summary run counts,
- current profile safety status.

The service writes only aggregate counts and safe timestamps. It does not persist raw report reasons,
raw message bodies, reporter email, user email, phone numbers, tokens, or raw AI payloads.

## Backoffice Usage

The case insights panel recomputes the target profile snapshot when a safe target profile is available.
The dashboard also exposes aggregate counts for high and critical risk snapshots.

Current behavior:

- lazy recomputation when case insights are opened,
- recomputation after profile enforcement actions,
- dashboard counts from persisted snapshots.

Deferred behavior:

- background recomputation job,
- stale snapshot monitor,
- profile directory filters by risk level,
- manual recompute action,
- trend history.

## Risk Score Semantics

The score is rules-based and intentionally explainable.

Current risk inputs include:

- restricted/suspended status,
- open case count,
- recent report count,
- recent enforcement count,
- sensitive access count,
- total case count,
- AI summary count.

The score is not a legal, medical, financial, or identity assessment. It is only an operational
Trust & Safety signal for marketplace abuse review.

## Privacy Boundaries

Do not expose snapshot data in public APIs.
Do not show the score to users or sellers.
Do not use it as the only basis for enforcement.
Do not include raw sensitive fields in snapshot metadata.

Allowed:

- aggregate counts,
- safe status enums,
- safe timestamps,
- profile ID.

Not allowed:

- reporter email,
- user email,
- phone,
- raw message body,
- raw report details,
- raw admin reason,
- raw AI input/output,
- token/cookie/auth internals.

## Validation

Run:

```bash
pnpm --filter @babyloop/database typecheck
pnpm --filter @babyloop/api typecheck
pnpm --filter @babyloop/backoffice typecheck
pnpm --filter @babyloop/api exec vitest run test/admin-moderation.schemas.test.ts --config vitest.config.ts
pnpm --filter @babyloop/api exec vitest run test/admin-dashboard.schemas.test.ts --config vitest.config.ts
```

Manual regression:

```bash
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test \
pnpm --filter @babyloop/api exec vitest run test/admin-moderation.integration.test.ts --config vitest.config.ts
```

## Next Steps

Recommended next work:

1. Profile/admin directory with safety and trust filters.
2. Monitoring dashboard expansion.
3. Background snapshot recomputation.
4. Snapshot stale/failed recompute monitoring.
5. Backoffice E2E coverage for insights and dashboard risk counts.
