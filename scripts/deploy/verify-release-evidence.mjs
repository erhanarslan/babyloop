#!/usr/bin/env node
import { readChecksummedEvidence } from "./release-evidence-lib.mjs";

const path = readArg("--path") || requiredEnv("RELEASE_EVIDENCE_PATH");
const kind = readArg("--kind") || process.env.RELEASE_EVIDENCE_KIND || undefined;
const gitSha = readArg("--git-sha") || process.env.RELEASE_EVIDENCE_GIT_SHA || undefined;
const maxAgeHours = Number(readArg("--max-age-hours") || process.env.RELEASE_EVIDENCE_MAX_AGE_HOURS || 72);
const result = await readChecksummedEvidence(path, { kind, gitSha, maxAgeHours });
process.stdout.write(`${JSON.stringify({
  ok: true,
  kind: result.evidence.kind,
  path: result.path,
  gitSha: result.evidence.gitSha,
  createdAt: result.evidence.createdAt,
  sha256: result.sha256
}, null, 2)}\n`);

function readArg(name) {
  const prefix = `${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || "";
}
function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
