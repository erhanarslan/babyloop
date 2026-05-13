# Coding Rules

## TypeScript and Structure

- Use TypeScript strict mode.
- Avoid huge files. Prefer focused modules with clear ownership.
- Keep folder boundaries explicit between apps and packages.
- Do not import from app internals across apps.
- Use shared packages only for stable, reusable contracts.
- Do not introduce abstractions until duplication or complexity justifies them.
- Do not add unused dependencies.
- Do not make fake production claims in docs, UI, logs, or comments.

## Validation and API Contracts

- Validate external input with Zod or an equivalent schema library.
- Use typed API responses with a consistent success/error shape.
- Never trust client-provided user ids, roles, prices, or moderation states.
- Keep API error messages useful but avoid leaking sensitive implementation details.
- Use pagination for list endpoints from the beginning.
- Use idempotency keys for payment/order-like actions later.

## Error Handling

- Return predictable error codes for client handling.
- Log server errors with request id and safe metadata.
- Do not log secrets, raw passwords, private tokens, or full payment data.
- Separate user-facing messages from internal error details.
- Background jobs should be retry-aware and dead-letter failed cases where appropriate.

## Environment Variables

- Validate environment variables at startup or lazy initialization boundaries.
- Keep `.env.example` updated when implementation begins.
- Never commit real secrets.
- Use separate variables for app URL, API URL, database URL, AI provider keys, object storage, and queue backend.
- In Next.js apps, expose only variables explicitly prefixed for public client usage.

## Logging and Audit Rules

- Log sensitive actions with actor, entity, action, timestamp, and reason.
- AI tasks must log prompt version, model/provider, input snapshot, output snapshot, confidence, risk score, and status.
- Human overrides must store previous AI recommendation and final human decision.
- Admin data access should be auditable.
- Prefer structured logs over free-form strings.
- Redact or minimize personal data in logs, especially private messages, contact details, child profile data, and precise location.

## AI Safety Rules

- AI must not claim certainty about baby product safety.
- AI should use checklists and warnings for car seats, cribs, carriers, and safety products.
- AI moderation decisions must be explainable with reason codes.
- High-impact actions require human review.
- RAG must distinguish trusted knowledge documents from user-generated content.
- Prompt injection risks must be considered for assistant and admin AI features.

## Database Rules

- Use migrations for schema changes.
- `packages/database` owns schema and migrations; apps and feature packages should not define competing table ownership.
- Keep audit/event logs append-only where possible.
- Use foreign keys for core relationships.
- Prefer explicit enum-like status values.
- Store timestamps consistently.
- Add indexes for common lookup paths, but avoid speculative indexing before queries exist.

## Testing Expectations

| Layer | Expectation |
| --- | --- |
| Shared types/schemas | Unit tests for validation and edge cases. |
| API services | Integration tests for validation, auth, permissions, and error responses. |
| Database | Migration verification and critical query tests. |
| AI modules | Schema validation, mocked provider tests, safety cases, prompt version references. |
| UI | Component or flow tests for critical listing, messaging, and admin paths. |
| Jobs | Tests for idempotency, retries, and failure behavior. |

## Frontend Rules

- Use accessible UI components and semantic HTML.
- Handle loading, empty, error, and permission states.
- Keep marketplace UI practical and task-focused.
- Avoid marketing-style landing pages before the product experience exists.
- Reuse shadcn/ui patterns once the apps are initialized.

## Dependency Rules

- Install dependencies only when needed for the current approved step.
- Prefer well-maintained libraries with clear value.
- Document why major dependencies are introduced.
- Remove unused packages during the same phase that makes them unnecessary.
