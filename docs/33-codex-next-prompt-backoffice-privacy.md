<!-- 2026-06-11-backoffice-privacy-redaction-foundation -->

# Codex Next Prompt — Backoffice Data Privacy + Redaction Foundation

You are continuing work on the BabyLoop monorepo.

## Project path

```bash
/Users/erhan-pc-mac/Desktop/babyloop
```

## Current active task

```txt
Backoffice Data Privacy + Redaction Foundation
```

## Current working tree context

Expected changed files may include:

```txt
apps/api/src/services/admin-moderation.service.ts
apps/api/src/services/redaction.service.ts
apps/api/test/admin-moderation.integration.test.ts
apps/api/test/redaction.service.test.ts
apps/backoffice/src/features/moderation/api.ts
docs/10-codex-working-plan.md
docs/21-current-implementation-state.md
docs/22-api-contract-rules.md
docs/23-architecture-decisions.md
docs/24-stabilization-roadmap.md
docs/25-validation-and-regression-checklist.md
docs/29-current-backlog-and-next-steps.md
docs/31-trust-and-safety-foundation.md
docs/32-backoffice-data-privacy-and-redaction.md
docs/33-codex-next-prompt-backoffice-privacy.md
```

## What was being implemented

The goal is to ensure default admin moderation API responses are minimized/redacted server-side.

Already intended changes:

1. Add `apps/api/src/services/redaction.service.ts`.
2. Use `createSafeTextPreview` in `admin-moderation.service.ts`.
3. Redact reporter identity by default:

```ts
reporter: {
  redacted: true
} | null
```

4. Remove reporter profile join/displayName from admin moderation list query.
5. Ensure message preview uses server-side redaction.
6. Remove `conversationId` from default message preview DTO.
7. Update backoffice raw type in `apps/backoffice/src/features/moderation/api.ts`.
8. Add PII regression coverage to `apps/api/test/admin-moderation.integration.test.ts`.
9. Add `apps/api/test/redaction.service.test.ts`.
10. Update docs.

## First commands to run

```bash
cd /Users/erhan-pc-mac/Desktop/babyloop

git status --short

grep -R "conversationId\|reporterDisplayName\|bodyPreview: message.body\|message.body.slice" -n \
  apps/api/src/services/admin-moderation.service.ts \
  apps/api/src/routes/admin-moderation.routes.ts \
  apps/backoffice/src/features/moderation/api.ts

grep -n "conversationId\|conversation.id" apps/api/test/admin-moderation.integration.test.ts

pnpm --filter @babyloop/api test -- redaction.service.test.ts admin-moderation.integration.test.ts
pnpm --filter @babyloop/api typecheck
pnpm --filter @babyloop/backoffice typecheck
```

## Expected grep behavior

The admin moderation response path grep should return no output.

The test grep may return:

```txt
conversationId: conversation.id
expect(serialized).not.toContain(conversation.id)
```

That is correct. The first line is test setup. The second line is the leak regression assertion.

## Do not do yet

Do not implement:

- Sensitive raw-data endpoint
- Permission matrix
- Audit log migration
- AI moderation summary
- Backoffice UI polish

Those come after current validation passes.

## If tests pass

Then run:

```bash
pnpm typecheck
pnpm build
```

Then produce a concise report of:

- Files changed
- Privacy guarantees added
- Tests passed
- Remaining next task
