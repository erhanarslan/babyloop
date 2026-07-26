import assert from "node:assert/strict";
import test from "node:test";
import {
  createPgEnvironment,
} from "../../ops/postgres-ops-lib.mjs";

test("uses the system CA store for libpq verify-full connections", () => {
  const env = createPgEnvironment(
    "postgresql://user:password@database.example.com:5432/app"
      + "?sslmode=verify-full&channel_binding=require",
    {
      PGSSLMODE: "disable",
      PGSSLROOTCERT: "/tmp/inherited-root.crt",
    },
  );

  assert.equal(env.PGSSLMODE, "verify-full");
  assert.equal(env.PGSSLROOTCERT, "system");
  assert.equal(env.PGCHANNELBINDING, "require");
});

test("preserves an explicitly configured libpq root certificate", () => {
  const env = createPgEnvironment(
    "postgresql://user:password@database.example.com:5432/app"
      + "?sslmode=verify-full"
      + "&sslrootcert=%2Fetc%2Fssl%2Fcustom-root.crt",
  );

  assert.equal(
    env.PGSSLROOTCERT,
    "/etc/ssl/custom-root.crt",
  );
});
