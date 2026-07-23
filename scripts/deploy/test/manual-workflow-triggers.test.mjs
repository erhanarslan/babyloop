import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertManualWorkflowSource,
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

  assert.deepEqual(
    extractWorkflowTriggers(source, "container-images.yml"),
    ["workflow_dispatch"]
  );
  assert.deepEqual(
    assertManualWorkflowSource(source, "container-images.yml"),
    ["workflow_dispatch"]
  );
});

test("accepts governed top-level push and pull_request triggers", () => {
  const source = `name: CI

on:
  workflow_dispatch:
  push:
    branches: [master]
  pull_request:
    branches: [dev, staging, master]
`;

  assert.deepEqual(
    assertManualWorkflowSource(source, "ci.yml"),
    ["workflow_dispatch", "push", "pull_request"]
  );
});

test("accepts inline workflow_dispatch trigger syntax", () => {
  assert.deepEqual(
    assertManualWorkflowSource(
      "name: CI\non: [workflow_dispatch]\njobs: {}\n"
    ),
    ["workflow_dispatch"]
  );
});

test("accepts schedule but rejects unsupported workflow_call", () => {
  const source = `name: Release
on:
  workflow_dispatch:
  schedule:
    - cron: "0 2 * * *"
  workflow_call:
`;

  assert.throws(
    () => assertManualWorkflowSource(source, "release.yml"),
    /unsupported trigger\(s\): workflow_call/
  );
});

test("rejects pull_request_target because it exposes a privileged event surface", () => {
  const source = `name: Unsafe
on:
  pull_request_target:
    branches: [master]
jobs: {}
`;

  assert.throws(
    () => assertManualWorkflowSource(source, "unsafe.yml"),
    /unsupported trigger\(s\): pull_request_target/
  );
});
