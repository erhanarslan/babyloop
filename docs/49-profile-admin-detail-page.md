# Profile Admin Detail Page

## Status

Implemented in this batch.

## Purpose

The profile admin detail page gives Trust & Safety operators a privacy-safe profile view
that connects profile directory results to operational context.

It is intentionally not a raw user browser. It does not expose user email, phone, raw
profile objects, raw reports, raw message bodies, raw AI input/output, cookies, tokens,
or password data.

## API

### `GET /api/v1/admin/profiles/:profileId`

Returns a safe profile detail DTO containing:

- profile id,
- display name,
- city if available,
- safety status,
- created/updated timestamps,
- listing count,
- profile trust snapshot if computed,
- listing status aggregates,
- recent listing summaries,
- related moderation case summaries,
- enforcement action summaries.

## Backoffice UI

Route:

- `/profiles/[profileId]`

The page shows:

- profile summary,
- trust/risk snapshot,
- operational stats,
- recent listings,
- related moderation cases,
- enforcement history.

The profile directory links each profile card to the new detail route.

## Privacy Boundaries

Allowed:

- safe display name,
- profile id,
- city,
- safety status,
- listing summaries,
- safe report reason enum,
- case status/priority,
- enforcement action type,
- trust/risk aggregate scores.

Disallowed:

- user email,
- phone,
- raw user/profile object,
- raw report details,
- reporter identity,
- raw message body,
- sensitive-access result data,
- raw AI input/output,
- raw enforcement reason,
- tokens/cookies/password hashes.

## Deferred

- profile-level enforcement controls directly from profile detail,
- full user/profile admin detail tabs,
- message/conversation admin review,
- profile safety event stream,
- profile trust snapshot recomputation jobs,
- RBAC permissions for profile views.
