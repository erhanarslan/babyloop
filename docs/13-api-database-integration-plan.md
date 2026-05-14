# API Database Integration Plan

## Scope

This plan describes the first API-to-database connection for BabyLoop. It should be implemented only after the database schema, migration, and seed flow are verified locally.

The first API slice must stay read-only:

- No auth
- No listing creation or edits
- No image upload
- No AI calls
- No moderation decisions
- No background jobs

## Package Imports

`apps/api` should depend on the database package through the workspace:

```json
{
  "dependencies": {
    "@babyloop/database": "workspace:*",
    "@babyloop/shared": "workspace:*",
    "@babyloop/config": "workspace:*"
  }
}
```

Recommended import boundaries:

| Import | Used by | Purpose |
| --- | --- | --- |
| `@babyloop/database` | API app/plugin layer | Create and close the database client. |
| `@babyloop/database/schema` | Route/service query files | Import table definitions for Drizzle queries. |
| `@babyloop/shared` | Route response types | Use typed `ApiResponse<T>` contracts. |
| `@babyloop/config` | Route registration | Use `API_PREFIX` for `/api/v1` endpoints. |

`apps/web` must not import `packages/database` directly. Web should call API endpoints only.

## Database Client Initialization

Use one Fastify database plugin in `apps/api` during the first integration step.

Recommended future structure:

```text
apps/api/src/
  plugins/
    database.plugin.ts
  routes/
    categories.routes.ts
    listings.routes.ts
  types/
    fastify.d.ts
```

Initialization approach:

1. Read `DATABASE_URL` during API startup.
2. Create one database client with `createDatabaseClient({ databaseUrl })`.
3. Decorate the Fastify instance with the typed database handle.
4. Close the database connection in Fastify `onClose`.
5. Keep tests able to inject a separate app/database client later.

Avoid creating a new database connection per request.

## Environment Variables

Required API runtime variable:

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes, once DB routes are enabled | PostgreSQL connection string used by `apps/api` and `packages/database`. |

Rules:

- Keep `DATABASE_URL` in `.env.example`.
- Do not log the full database URL.
- Fail fast during API startup if read-only DB routes are registered and `DATABASE_URL` is missing.
- Do not add Redis, AI provider keys, auth secrets, or storage credentials in this step.

## Error Handling

Keep responses consistent with the existing API error shape.

| Case | HTTP status | Response code |
| --- | --- | --- |
| Invalid listing id format | `400` | `INVALID_REQUEST` |
| Listing not found | `404` | `NOT_FOUND` |
| Database unavailable | `503` | `DATABASE_UNAVAILABLE` |
| Unexpected query failure | `500` | `INTERNAL_SERVER_ERROR` |

Rules:

- Do not expose SQL errors, connection strings, stack traces, or table internals to clients.
- Log server-side errors through Fastify logger.
- Return typed `ApiResponse<T>` payloads.
- Validate route params before querying.

## First Read-Only Endpoints

All endpoints should use `API_PREFIX`, currently `/api/v1`.

| Endpoint | Purpose | Notes |
| --- | --- | --- |
| `GET /api/v1/categories` | Return product category tree/list. | Include `id`, `name`, `slug`, `parentId`. |
| `GET /api/v1/listings` | Return active listing summaries. | Include seller profile summary, category summary, first image, price, status, condition. |
| `GET /api/v1/listings/:id` | Return one listing detail. | Include images, seller profile summary, category summary. |

Initial listing responses should be simple and marketplace-safe:

- Return active listings only.
- Do not return private profile data.
- Do not include analytics internals or event metadata.
- Do not implement search, pagination, sorting, or filters until the basic read path is verified.

## Why Mutations Come Later

Listing mutation endpoints should come after this read-only slice because writes need more product decisions:

- Auth and seller ownership
- Input validation with Zod
- Listing status transitions
- Image upload/storage rules
- Audit/event logging for writes
- Safety checks for baby products
- Future moderation and AI suggestion hooks

Adding mutations before these boundaries are clear would make implementation harder to audit and refactor.

## Verification Checklist

Implement and verify in this order:

1. Add `@babyloop/database`, `@babyloop/shared`, and `@babyloop/config` as `apps/api` workspace dependencies.
2. Extend API env reading with `DATABASE_URL`.
3. Add the Fastify database plugin.
4. Register read-only route files under `/api/v1`.
5. Run database migration locally.
6. Run database seed locally.
7. Run API typecheck and build.
8. Start API with `DATABASE_URL`.
9. Verify `GET /health` still works.
10. Verify `GET /api/v1/categories`.
11. Verify `GET /api/v1/listings`.
12. Verify `GET /api/v1/listings/:id` with a seeded listing id.
13. Confirm no auth, AI, write endpoints, queues, or external services were added.

## Risks and TODOs

| Item | Handling |
| --- | --- |
| No auth yet | Read-only public data only. Do not expose private profile fields. |
| No pagination yet | Acceptable for seed data, but add pagination before real data volume. |
| No search/filtering yet | Keep first query small; search comes after basic DB reads. |
| No API-level Zod validation yet | Validate listing id minimally first; add Zod when request shapes grow. |
| Database unavailable during local dev | Return `503` for request-time DB failures and document `DATABASE_URL`. |
