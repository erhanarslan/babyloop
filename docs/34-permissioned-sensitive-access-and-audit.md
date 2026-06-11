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
  reason
```

Denied access currently returns a safe error response but is not persisted. Denied-access audit logging is deferred.

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
