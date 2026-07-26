#!/usr/bin/env node
import { appendFile } from "node:fs/promises";
import { resolve } from "node:path";
import { readJsonReceipt } from "./deployment-lib.mjs";

const environment = String(process.env.DEPLOY_ENVIRONMENT || "unknown").trim().toLowerCase();
const contractPath = resolve(
  process.env.DEPLOY_RELEASE_CONTRACT_PATH
    || `.release/gcp/${environment}/resolved-release-contract.json`
);
const metadataPath = resolve(`.release/gcp/${environment}/deployment-metadata.json`);
const contractReceipt = await safeOptionalReceipt(contractPath);
const metadataReceipt = await safeOptionalReceipt(metadataPath);
const contract = contractReceipt.value;
const metadata = metadataReceipt.value;
const summaryPath = process.env.GITHUB_STEP_SUMMARY;
const publicAcceptance = String(
  metadata?.acceptance?.publicAcceptance
    || (environment === "staging" ? "not complete" : "not completed")
);

const lines = [
  `## ${environment === "production" ? "Production" : "Staging"} deployment`,
  "",
  `- Result: \`${process.env.DEPLOY_JOB_STATUS || "unknown"}\``,
  `- Resolved release contract: \`${receiptLabel(contractReceipt, contractPath)}\``,
  `- Release SHA: \`${contract?.gitSha || process.env.GITHUB_SHA || "unresolved"}\``,
  `- Smoke/metadata: \`${metadata?.status || receiptLabel(metadataReceipt, "not completed")}\``,
  `- Infrastructure deployment: \`${metadata ? "passed" : "not completed"}\``,
  `- Exact run.app deployment smoke: \`${metadata ? "passed" : "not completed"}\``,
  `- Canonical public surfaces: \`${String(metadata?.acceptance?.canonicalPublicSurfaces || "unavailable / warning").replaceAll("_", " / ")}\``,
  `- Public ${environment} acceptance: \`${publicAcceptance.replaceAll("_", " ")}\``,
  "- Database schema rollback is never automatic.",
  "- Evidence, scans, backup references, rollback inputs, and checksums are in the release artifact."
];
const output = `${lines.join("\n")}\n`;
if (summaryPath) {
  try {
    await appendFile(summaryPath, output, "utf8");
  } catch {
    process.stdout.write(output);
  }
} else {
  process.stdout.write(output);
}

async function safeOptionalReceipt(path) {
  try {
    const value = await readJsonReceipt(path, { optional: true });
    return value ? { state: "readable", value } : { state: "not_produced", value: null };
  } catch {
    return { state: "unreadable", value: null };
  }
}

function receiptLabel(receipt, readableLabel) {
  if (receipt.state === "readable") return readableLabel;
  return receipt.state === "unreadable" ? "unreadable" : "not produced";
}
