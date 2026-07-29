import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("production installs age before encrypted database backup", async () => {
  const workflow = await readFile(
    ".github/workflows/promote-production.yml",
    "utf8",
  );

  const installIndex = workflow.indexOf(
    "- name: Install backup encryption tool",
  );

  const backupIndex = workflow.indexOf(
    "- name: Mandatory encrypted backup",
  );

  assert.notEqual(
    installIndex,
    -1,
    "production workflow must install age",
  );

  assert.notEqual(
    backupIndex,
    -1,
    "production workflow must contain verified backup",
  );

  assert.ok(
    installIndex < backupIndex,
    "age must be installed before the backup step",
  );

  const installStep = workflow.slice(
    installIndex,
    backupIndex,
  );

  assert.match(
    installStep,
    /sudo apt-get install --yes --no-install-recommends age/u,
  );

  assert.match(
    installStep,
    /age --version/u,
  );
});
