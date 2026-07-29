import assert from "node:assert/strict";
import test from "node:test";
import { assertReleaseE2EPortsAvailable } from "../../check-release-e2e-ports.mjs";

test("release E2E port preflight checks and releases every configured port", async () => {
  const opened = [];
  const closed = [];

  await assert.doesNotReject(assertReleaseE2EPortsAvailable(
    ["4000", "3000", "3001"],
    {
      openPort: async (port) => {
        opened.push(port);
        return {
          close(callback) {
            closed.push(port);
            callback();
          },
        };
      },
    },
  ));

  assert.deepEqual(opened, [4000, 3000, 3001]);
  assert.deepEqual(closed.sort(), [3000, 3001, 4000]);
});

test("release E2E port preflight rejects an occupied port without exposing process details", async () => {
  await assert.rejects(
    assertReleaseE2EPortsAvailable(["4000"], {
      openPort: async (port) => {
        throw new Error(`Port ${port} is unavailable. Stop local services before running release E2E.`);
      },
    }),
    (error) => {
      assert.match(error.message, /Port 4000 is unavailable/);
      assert.doesNotMatch(error.message, /pid|credential|postgres/iu);
      return true;
    },
  );
});

test("release E2E port preflight rejects invalid port input before opening sockets", async () => {
  await assert.rejects(assertReleaseE2EPortsAvailable(["not-a-port"]), /integers between 1 and 65535/);
});
