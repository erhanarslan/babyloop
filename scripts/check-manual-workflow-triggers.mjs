#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const WORKFLOW_DIRECTORY = ".github/workflows";
const ALLOWED_TRIGGERS = new Set([
  "pull_request",
  "push",
  "schedule",
  "workflow_dispatch"
]);
const PROHIBITED_TOKENS = [
  "pull_request_target:",
  "secrets: inherit"
];

const CONTRACTS = new Map([
  ["ci.yml", {
    requiredTriggers: ["pull_request", "workflow_dispatch"],
    forbiddenTriggers: ["push", "schedule"],
    requiredTokens: ["branches: [dev, staging, master]"]
  }],
  ["staging.yml", {
    requiredTriggers: ["push", "workflow_dispatch"],
    forbiddenTriggers: ["pull_request", "schedule"],
    requiredTokens: [
      "branches: [staging]",
      "environment: staging",
      "github.ref == 'refs/heads/staging'"
    ]
  }],
  ["production.yml", {
    requiredTriggers: ["push", "workflow_dispatch"],
    forbiddenTriggers: ["pull_request", "schedule"],
    requiredTokens: [
      "branches: [master]",
      "environment: production",
      "github.ref == 'refs/heads/master'"
    ]
  }],
  ["security.yml", {
    requiredTriggers: ["pull_request", "push", "schedule", "workflow_dispatch"],
    forbiddenTriggers: [],
    requiredTokens: ["branches: [dev, staging, master]"]
  }]
]);

export function extractWorkflowTriggers(source, file = "<workflow>") {
  const lines = source.replace(/^\uFEFF/u, "").split(/\r?\n/u);
  const onLineIndex = lines.findIndex((line) =>
    /^(?:"on"|'on'|on)\s*:/u.test(line)
  );

  if (onLineIndex < 0) {
    throw new Error(`${file} does not define a top-level on: trigger.`);
  }

  const match = lines[onLineIndex].match(
    /^(?:"on"|'on'|on)\s*:\s*(.*?)\s*$/u
  );
  const inline = stripComment(match?.[1] ?? "").trim();

  if (inline) return parseInlineTriggers(inline, file);

  const triggers = [];
  let childIndent = null;

  for (let index = onLineIndex + 1; index < lines.length; index += 1) {
    const rawLine = lines[index];
    if (!rawLine.trim() || rawLine.trimStart().startsWith("#")) continue;

    const indent = rawLine.match(/^\s*/u)?.[0].length ?? 0;
    if (indent === 0) break;

    const keyMatch = rawLine.match(
      /^\s*([A-Za-z_][A-Za-z0-9_-]*)\s*:/u
    );
    if (!keyMatch) continue;

    if (childIndent === null) childIndent = indent;
    if (indent === childIndent) triggers.push(keyMatch[1]);
  }

  if (triggers.length === 0) {
    throw new Error(
      `${file} has an empty or unsupported top-level on: trigger.`
    );
  }

  return [...new Set(triggers)];
}

export function assertWorkflowSource(source, file = "<workflow>") {
  const triggers = extractWorkflowTriggers(source, file);
  const disallowed = triggers.filter(
    (trigger) => !ALLOWED_TRIGGERS.has(trigger)
  );

  if (disallowed.length > 0) {
    throw new Error(
      `${file} contains unsupported trigger(s): ${disallowed.join(", ")}.`
    );
  }

  for (const token of PROHIBITED_TOKENS) {
    if (source.includes(token)) {
      throw new Error(
        `${file} contains prohibited workflow token ${JSON.stringify(token)}.`
      );
    }
  }

  return triggers;
}

// Compatibility for old imports; behavior is now governance-based.
export const assertManualWorkflowSource = assertWorkflowSource;

export async function checkManualWorkflowDirectory(
  directory = WORKFLOW_DIRECTORY
) {
  const entries = await readdir(directory, { withFileTypes: true });
  const workflowFiles = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        [".yml", ".yaml"].includes(extname(entry.name).toLowerCase())
    )
    .map((entry) => entry.name)
    .sort();

  if (workflowFiles.length === 0) {
    throw new Error(`No workflow files were found in ${directory}.`);
  }

  const checked = [];

  for (const name of workflowFiles) {
    const file = resolve(directory, name);
    const source = await readFile(file, "utf8");
    const triggers = assertWorkflowSource(source, file);
    const contract = CONTRACTS.get(name);

    if (contract) {
      for (const trigger of contract.requiredTriggers) {
        if (!triggers.includes(trigger)) {
          throw new Error(`${file} must define ${trigger}.`);
        }
      }
      for (const trigger of contract.forbiddenTriggers) {
        if (triggers.includes(trigger)) {
          throw new Error(`${file} must not define ${trigger}.`);
        }
      }
      for (const token of contract.requiredTokens) {
        if (!source.includes(token)) {
          throw new Error(
            `${file} must contain ${JSON.stringify(token)}.`
          );
        }
      }
    }

    checked.push({ file, triggers });
  }

  for (const requiredFile of CONTRACTS.keys()) {
    if (!workflowFiles.includes(requiredFile)) {
      throw new Error(`Required workflow is missing: ${requiredFile}.`);
    }
  }

  return checked;
}

function parseInlineTriggers(value, file) {
  const normalized = value.trim();

  if (normalized.startsWith("[") && normalized.endsWith("]")) {
    const triggers = normalized
      .slice(1, -1)
      .split(",")
      .map(unquote)
      .map((trigger) => trigger.trim())
      .filter(Boolean);
    if (triggers.length === 0) {
      throw new Error(
        `${file} has an empty inline on: trigger list.`
      );
    }
    return [...new Set(triggers)];
  }

  if (normalized.startsWith("{") && normalized.endsWith("}")) {
    const triggers = [
      ...normalized.matchAll(
        /(?:^|,)\s*([A-Za-z_][A-Za-z0-9_-]*)\s*:/gu
      )
    ].map((match) => match[1]);
    if (triggers.length === 0) {
      throw new Error(
        `${file} has an unsupported inline on: mapping.`
      );
    }
    return [...new Set(triggers)];
  }

  return [unquote(normalized)];
}

function unquote(value) {
  return value.replace(/^(['"])(.*)\1$/u, "$2").trim();
}

function stripComment(value) {
  return value.replace(/\s+#.*$/u, "");
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";

if (invokedPath === import.meta.url) {
  try {
    const checked = await checkManualWorkflowDirectory(
      process.env.WORKFLOW_DIRECTORY || WORKFLOW_DIRECTORY
    );
    console.log(
      `Workflow governance guard passed for ${checked.length} workflow file(s).`
    );
  } catch (error) {
    console.error("Workflow governance guard failed:");
    console.error(
      `- ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
}
