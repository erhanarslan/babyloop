# Profile Admin Directory

## Purpose

The profile admin directory gives backoffice operators a safe profile-level view of
Trust & Safety signals. It builds on profile safety statuses and profile trust/risk
snapshots.

This is an operational directory, not a raw user data browser.

## Added Capabilities

- `GET /api/v1/admin/profiles`
- Backoffice `/profiles` page
- Filters for safety status and trust/risk level
- Safe search by display name, city, or profile id
- Sorting by risk, trust, and profile age
- Listing count per profile
- Trust/risk snapshot summary when available

## Privacy Boundaries

The directory intentionally excludes:

- user email,
- phone numbers,
- raw user records,
- raw report reasons,
- raw message bodies,
- raw AI input/output,
- tokens/cookies/session internals,
- child profile data.

Visible data is limited to safe operational signals:

- profile id,
- display name,
- city if already stored on profile,
- safety status,
- listing count,
- trust/risk scores and aggregate counts from the snapshot.

## Snapshot Behavior

Profiles may not have a trust snapshot until a case insight or enforcement workflow
computes one. The directory shows those profiles with a safe empty snapshot state.

This avoids triggering expensive recomputation for every profile list request.

## Deferred

- Profile detail page
- Profile enforcement from profile detail
- Open case links per profile
- Profile activity timeline
- Bulk recomputation jobs
- Pagination cursor metadata
- Granular RBAC for profile directory access
