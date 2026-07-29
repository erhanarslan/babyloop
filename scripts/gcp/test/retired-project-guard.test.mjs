import assert from "node:assert/strict";
import test from "node:test";
import { findRetiredProjectReferences } from "../retired-project-guard.mjs";

test("retired project guard scans every tracked text file type and safely skips binaries", () => {
  const retired = ["babyloop", "production"].join("-");
  const files = [
    "src/config.ts",
    "scripts/release.sh",
    ".env.example",
    "deploy/Dockerfile",
    "image.bin",
    "docs/deployment/single-production-environment-migration.md"
  ];
  const contents = new Map(files.map((file) => [file, Buffer.from(`target=${retired}`)]));
  contents.set("image.bin", Buffer.from([0, 1, 2, 3]));
  assert.deepEqual(findRetiredProjectReferences({
    files,
    exists: () => true,
    read: (file) => contents.get(file)
  }), [
    "src/config.ts",
    "scripts/release.sh",
    ".env.example",
    "deploy/Dockerfile"
  ]);
});
