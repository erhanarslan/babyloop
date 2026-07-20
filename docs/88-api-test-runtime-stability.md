# API test runtime stability

The API regression suite rebuilds the isolated test schema repeatedly. On constrained developer hardware, late DB-heavy suites could cross the previous 30-second Vitest budget even when application behavior remained correct.

The reset helper now uses one PostgreSQL pool for schema reset and migration, limits that pool to one connection, and applies explicit lock and statement timeouts. This reduces connection churn and turns a real database lock into a diagnostic PostgreSQL error instead of a generic Vitest hook timeout.

Vitest hook and test budgets are 60 seconds. This does not delay passing tests; it only prevents false negatives during the full serial regression suite.

Run the focused stability gate with:

```bash
pnpm security:api-test-runtime-stability
```

Run the previously flaky files with:

```bash
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test \
  pnpm --filter @babyloop/api exec vitest run --config vitest.config.ts \
  test/backoffice-route-permissions.integration.test.ts \
  test/child-reminder-scheduler.service.test.ts
```
