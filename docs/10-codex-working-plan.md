# Codex Working Plan

## Collaboration Rules

- Work in small, verifiable steps.
- Do not start coding before the requested documentation or planning step is complete.
- Do not create large amounts of code in one step.
- Do not initialize the monorepo, install packages, or create app code unless explicitly requested.
- Preserve existing working code.
- Never rewrite unrelated files.
- Ask only when a blocking decision is truly required.

## Step Format

After each major step, provide:

1. What was created or changed.
2. Files created or modified.
3. How to verify locally.
4. Risks or TODOs.
5. Suggested next step.

Then stop and wait for confirmation.

## Working Sequence

| Step | Goal | Output |
| --- | --- | --- |
| 1 | Architecture documentation | `/docs` files only |
| 2 | Monorepo foundation | pnpm, Turborepo, TypeScript config, minimal needed boundaries |
| 3 | Database foundation | schema tooling, migrations, core tables |
| 4 | API foundation | health endpoint, validation, typed responses |
| 5 | Web marketplace slice | browse/detail/create listing basics |
| 6 | Admin moderation slice | queue, decisions, audit logs |
| 7 | AI logging foundation | provider abstraction, prompt versions, task logs |
| 8 | AI listing helper | structured listing suggestions |
| 9 | Valuation v1 | price range, confidence, missing info |
| 10 | Messaging/moderation | conversations and behavior-based message risk scoring |
| 11 | RAG assistant | knowledge base, embeddings, retrieval logging |
| 12 | Recommendations/automation | events, ranking, notifications, stale listing jobs |

The foundation may start with only `apps/web`, `apps/api`, `packages/shared`, and `packages/config`. Later apps and packages remain planned final-scope components and should be added only when their roadmap step needs them.

## Verification Discipline

Each step should include the smallest meaningful verification:

- file existence for documentation
- install/build/lint for foundation work
- migration check for database work
- API request for backend work
- browser check for frontend work
- mocked provider tests for AI work
- job execution test for worker automation

## Change Control

- Keep changes scoped to the active step.
- Prefer editing existing patterns over adding new frameworks.
- Avoid placeholder code unless required to verify the current step.
- Do not create empty future apps/packages unless the current approved step needs them.
- Document TODOs instead of implementing future phases early.
- If unrelated dirty files exist, leave them untouched.
- If user changes conflict with the current task, adapt to them rather than reverting them.

## Communication Style

- Progress explanations to the user should be in Turkish.
- Documentation and code comments should be in English.
- Summaries should be concise and specific.
- Architectural decisions should include a short reason.
- Open questions should be listed only when they block the next step.


<!-- 2026-06-11-backoffice-privacy-redaction-foundation -->
## 2026-06-11 Update — Backoffice Data Privacy + Redaction Foundation

### Current Codex continuation point

Current active implementation task:

```txt
Backoffice Data Privacy + Redaction Foundation
```

The next Codex session must continue from the current dirty working tree and must not restart the project.

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

First commands for Codex:

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

Do not implement sensitive raw-data access yet. That is the next design task after this patch validates.
