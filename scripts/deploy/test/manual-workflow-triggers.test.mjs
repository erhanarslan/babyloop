import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertManualWorkflowSource,
  assertReleaseWorkflowSource,
  extractWorkflowTriggers
} from "../../check-manual-workflow-triggers.mjs";

test("accepts workflow_dispatch while ignoring nested build action push input", () => {
  const source = `name: Container images

on:
  workflow_dispatch:
    inputs:
      environment:
        required: true

jobs:
  build:
    steps:
      - uses: docker/build-push-action@v6
        with:
          push: true
`;

  assert.deepEqual(extractWorkflowTriggers(source, "container-images.yml"), [
    "workflow_dispatch"
  ]);
  assert.deepEqual(assertManualWorkflowSource(source, "container-images.yml"), [
    "workflow_dispatch"
  ]);
});

test("rejects top-level push and pull_request triggers", () => {
  const source = `name: CI

on:
  workflow_dispatch:
  push:
    branches: [main]
  pull_request:
`;

  assert.throws(
    () => assertManualWorkflowSource(source, "ci.yml"),
    /disallowed top-level trigger\(s\): push, pull_request/
  );
});

test("accepts inline manual-only trigger syntax", () => {
  assert.deepEqual(
    assertManualWorkflowSource("name: CI\non: [workflow_dispatch]\njobs: {}\n"),
    ["workflow_dispatch"]
  );
});

test("rejects schedule and workflow_call even when workflow_dispatch exists", () => {
  const source = `name: Release
on:
  workflow_dispatch:
  schedule:
    - cron: "0 2 * * *"
  workflow_call:
`;

  assert.throws(
    () => assertManualWorkflowSource(source, "release.yml"),
    /schedule, workflow_call/
  );
});

test("accepts PR CI only for staging and master", () => {
  const source = `name: CI
on:
  pull_request:
    branches: [staging, master]
  workflow_call:
  workflow_dispatch:
jobs: {}
`;
  assert.deepEqual(assertReleaseWorkflowSource(source, "ci.yml"), [
    "pull_request",
    "workflow_call",
    "workflow_dispatch"
  ]);
});

test("accepts protected staging push deployment and rejects an untracked workflow", () => {
  const source = `name: Deploy staging
on:
  push:
    branches: [staging]
  workflow_dispatch:
jobs: {}
`;
  assert.deepEqual(assertReleaseWorkflowSource(source, "deploy-staging.yml"), [
    "push",
    "workflow_dispatch"
  ]);
  assert.throws(
    () => assertReleaseWorkflowSource(source, "unknown.yml"),
    /no explicit release trigger policy/
  );
});
