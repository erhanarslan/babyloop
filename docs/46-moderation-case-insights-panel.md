# Moderation Case Insights Panel

## Purpose

The moderation case insights panel adds safe decision-support signals to the backoffice
moderation detail page.

The goal is to help admins answer:

- is this target repeatedly reported?
- is there prior enforcement history?
- has sensitive context been requested?
- has AI already reviewed the case?
- is the target profile already restricted or suspended?
- what is a reasonable next operational step?

This is not an automated enforcement system. It does not make final decisions for admins.

## API

Endpoint:

```http
GET /api/v1/admin/moderation/cases/:caseId/insights
```

Authentication:

- admin-only backoffice auth.

Response includes:

- target profile safety summary when safely derivable,
- open/total cases for the same target,
- report counts for the last 7 and 30 days,
- enforcement action counts,
- sensitive-access event count,
- AI summary run counts,
- latest successful AI summary signal,
- rules-based risk score and risk level,
- recommended next operational step.

## Privacy Boundaries

The endpoint must not expose:

- reporter email,
- user email,
- phone number,
- raw message body,
- raw report reason text,
- raw AI input,
- raw AI output,
- raw event metadata,
- tokens, cookies, or password hashes.

It may expose:

- safe target profile display name,
- target profile safety status,
- safe IDs,
- safe counts,
- safe enum-like risk and recommendation signals,
- AI run ID and AI risk level.

## Risk Score

The risk score is a rules-based operational signal from 0 to 100.

Inputs include:

- case priority,
- number of open cases for the target,
- recent report volume,
- recent enforcement history,
- sensitive-access activity,
- latest AI summary risk level,
- target profile safety status.

Risk levels:

- low,
- medium,
- high,
- critical.

This score is internal-only. It is not shown to marketplace users and must not be used as
the sole basis for enforcement.

## Backoffice UI

The moderation detail page now shows a `Case insights` panel with:

- risk score card,
- risk signals,
- suggested next step,
- target profile summary,
- case/report/enforcement/sensitive/AI metrics,
- latest AI signal.

## Deferred

- persistent profile trust/risk snapshots,
- dashboard-wide high-risk queue,
- AI operations dashboard,
- assignment/SLA integration,
- granular RBAC for insight visibility,
- automated case priority recalculation.
