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
