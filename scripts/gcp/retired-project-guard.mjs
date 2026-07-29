import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readlinkSync } from "node:fs";

export const RETIRED_PROJECT_ALLOWLIST = new Set([
  "docs/deployment/single-production-environment-migration.md"
]);

export function listTrackedFiles({ execute = execFileSync } = {}) {
  return execute("git", ["ls-files", "-z"], { encoding: "utf8" })
    .split("\0")
    .filter(Boolean);
}

export function findRetiredProjectReferences({
  files = listTrackedFiles(),
  read = readTrackedFile,
  exists = existsSync,
  allowlist = RETIRED_PROJECT_ALLOWLIST
} = {}) {
  const retiredProject = ["babyloop", "production"].join("-");
  const references = [];
  for (const file of files) {
    if (allowlist.has(file) || !exists(file)) continue;
    const content = read(file);
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
    if (buffer.includes(0)) continue;
    if (buffer.toString("utf8").includes(retiredProject)) references.push(file);
  }
  return references;
}

function readTrackedFile(path) {
  return lstatSync(path).isSymbolicLink()
    ? Buffer.from(readlinkSync(path))
    : readFileSync(path);
}
