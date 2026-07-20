import { readFileSync } from "node:fs";

const checks = [
  {
    path: "apps/api/vitest.config.ts",
    tokens: ["hookTimeout: 60_000", "testTimeout: 60_000"]
  },
  {
    path: "apps/api/test/helpers/db.ts",
    tokens: [
      "connectionTimeoutMillis: 10_000",
      "max: 1",
      "SET lock_timeout = '15s'",
      "SET statement_timeout = '60s'",
      "await migrate(client.db",
      "await client.close()"
    ]
  },
  {
    path: "apps/api/test/backoffice-route-permissions.integration.test.ts",
    tokens: ["if (app)", "await app.close()"]
  }
];

const failures = [];
for (const check of checks) {
  const content = readFileSync(check.path, "utf8");
  for (const token of check.tokens) {
    if (!content.includes(token)) {
      failures.push(`${check.path} must contain ${JSON.stringify(token)}`);
    }
  }
}

const dbHelper = readFileSync("apps/api/test/helpers/db.ts", "utf8");
const clientCreations = (dbHelper.match(/createDatabaseClient\(/g) ?? []).length;
if (clientCreations !== 1) {
  failures.push(`apps/api/test/helpers/db.ts must create exactly one database client; found ${clientCreations}`);
}

if (failures.length > 0) {
  console.error("API test runtime stability boundary failed:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log("API test runtime stability boundary passed.");
