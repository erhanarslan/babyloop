#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { assertEvidence } from "./release-evidence-lib.mjs";
import { writeJsonReceipt } from "./deployment-lib.mjs";

const inputPath = resolve(readArg("--input") || requiredEnv("MANUAL_EVIDENCE_INPUT"));
const outputPath = resolve(readArg("--output") || process.env.MANUAL_EVIDENCE_OUTPUT || inputPath.replace(/\.json$/u, ".signed.json"));
const expectedKind = readArg("--kind") || process.env.MANUAL_EVIDENCE_KIND || undefined;
const evidence = assertEvidence(JSON.parse(await readFile(inputPath, "utf8")), expectedKind);
const receipt = await writeJsonReceipt(outputPath, evidence);
process.stdout.write(`${JSON.stringify({ ok: true, kind: evidence.kind, outputPath: receipt.path, checksum: receipt.checksum }, null, 2)}\n`);

function readArg(name) {
  const prefix = `${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || "";
}

function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
