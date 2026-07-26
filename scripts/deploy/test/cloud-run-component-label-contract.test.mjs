import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  normalizeGcpLabelValue,
} from "../../gcp/cloud-run-lib.mjs";

const VALID_GCP_LABEL_VALUE = /^[a-z0-9_-]{1,63}$/u;

test("Cloud Run component labels normalize every contract key", async () => {
  const [
    contractSource,
    deploySource,
  ] = await Promise.all([
    readFile(
      "deploy/gcp/cloud-run.contract.json",
      "utf8",
    ),
    readFile(
      "scripts/gcp/deploy-cloud-run.mjs",
      "utf8",
    ),
  ]);

  const contract = JSON.parse(contractSource);

  assert.equal(
    normalizeGcpLabelValue("childReminder"),
    "child-reminder",
  );

  const componentKeys = [
    ...Object.keys(contract.services),
    ...Object.keys(contract.jobs),
  ];

  for (const key of componentKeys) {
    const normalized = normalizeGcpLabelValue(key);

    assert.match(
      normalized,
      VALID_GCP_LABEL_VALUE,
      `Invalid normalized component label for ${key}`,
    );

    assert.ok(
      normalized.length <= 63,
      `Component label is too long for ${key}`,
    );
  }

  assert.match(
    deploySource,
    /component=\$\{normalizeGcpLabelValue\(role\)\}/u,
  );

  assert.match(
    deploySource,
    /component=\$\{normalizeGcpLabelValue\(key\)\}/u,
  );
});
