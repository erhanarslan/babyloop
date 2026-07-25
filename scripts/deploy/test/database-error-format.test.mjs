import assert from "node:assert/strict";
import test from "node:test";
import { formatDatabaseError } from "../../ops/database-error-format.mjs";

test("formats nested database connection errors without exposing credentials or hosts", () => {
  const nested = Object.assign(
    new Error("connect ETIMEDOUT 203.0.113.10:5432"),
    {
      code: "ETIMEDOUT",
      syscall: "connect",
    },
  );

  const error = new AggregateError([nested], "");

  const message = formatDatabaseError(
    error,
    "postgresql://babyloop_user:super-secret@db.example.com:5432/babyloop_staging",
  );

  assert.match(message, /code=ETIMEDOUT/u);
  assert.match(message, /syscall=connect/u);
  assert.match(message, /\[IP\]:5432/u);

  assert.doesNotMatch(message, /super-secret/u);
  assert.doesNotMatch(message, /babyloop_user/u);
  assert.doesNotMatch(message, /db\.example\.com/u);
  assert.doesNotMatch(message, /203\.0\.113\.10/u);
});

test("returns a stable fallback for empty errors", () => {
  assert.equal(
    formatDatabaseError(new AggregateError([], "")),
    "Unknown database release error.",
  );
});
