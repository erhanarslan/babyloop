<!-- 2026-06-11-permissioned-sensitive-access-and-audit -->
# Permissioned Sensitive Raw Data Access + Audit

BabyLoop backoffice moderation remains redacted by default.

Raw sensitive data is available only through an explicit human backoffice action, not through default list/detail responses.

## Endpoint

```txt
POST /api/v1/admin/moderation/cases/:caseId/sensitive-access
```

Request:

```ts
{
  reason: string;
  fields: Array<"reporter" | "message">;
}
```

Response:

```ts
{
  caseId: string;
  grantedFields: Array<"reporter" | "message">;
  sensitive: {
    reporter?: {
      profileId: string;
      displayName: string | null;
      email: string | null;
    };
    message?: {
      id: string;
      body: string;
      senderProfileId: string;
      createdAt: string;
    };
  };
  auditEventId: string;
}
```

## Controls

- Admin auth is required.
- Access goes through `requireSensitiveDataAccess`.
- `reason` is required, trimmed, at least 10 characters, and max 1000 characters.
- `fields` is required, non-empty, allowlisted, and has no wildcard.
- Successful access writes an audit event before returning data.
- Denied access writes an audit event when actor and moderation-case context are safely available.
- Default moderation list/detail endpoints stay redacted.

## Audit Storage

Audit records use the existing `events` table.

```txt
eventType: admin_sensitive_access_granted
entityType: moderation_case
entityId: moderation case id
metadata:
  moderationCaseId
  targetType
  targetId
  requestedFields
  grantedFields
  deniedFields
  reason

eventType: admin_sensitive_access_denied
entityType: moderation_case
entityId: moderation case id
metadata:
  moderationCaseId
  targetType
  targetId
  requestedFields
  deniedFields
  denialReason
```

Audit metadata must not include raw message bodies, reporter email, tokens, auth/session metadata, full profile data, full listing data, or full conversation data.

The granted audit still stores the operator-provided reason for compatibility. Operators should not put unnecessary personal data in the reason. Denied audits do not store the free-text reason.

Unauthenticated requests and malformed case ids may return safe errors without DB audit rows because actor/case context is unavailable.

## Deliberate Non-Exposure

This first version does not expose:

- conversation participants
- full conversation data
- full profile data
- full listing data
- auth/session metadata

## Backoffice UI Rule

The backoffice must not request raw sensitive data automatically on case detail load.

The implemented case detail UI requires:

1. explicit click
2. warning
3. reason entry
4. field selection
5. submit action
6. clearly marked sensitive panel after grant
7. audit event id display
8. clear action that removes returned sensitive data from component state

The UI must not store sensitive data in localStorage, sessionStorage, URL params, cookies, or console logs.

## AI Rule

AI must operate on redacted/minimized moderation DTOs by default.

AI must not call this raw-access endpoint by default.

Any future AI use of raw sensitive data requires a separate permission, audit, and retention design.

## Current Limitation

The first permission gate is a compatibility helper that allows `admin` users. This is intentionally isolated so granular permissions can replace it later without changing route handlers.

## Moderation List Triage

The backoffice moderation list may filter by status, target type, safe search text, sort, and limit, and may show summary counts for the current result set.

These list controls do not call the sensitive-access endpoint and do not reveal raw sensitive fields.

Search remains limited to safe operational fields such as case id, report id, target id, target type, status, and report reason/status. Raw message bodies, reporter identity, conversation participants, emails, tokens, and session metadata are outside the list/search contract.

Summary cards are operational metadata for triage only. They are not a raw sensitive-data view.
