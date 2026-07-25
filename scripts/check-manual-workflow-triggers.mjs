#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { basename, extname, resolve } from "node:path";

const WORKFLOW_DIRECTORY = ".github/workflows";
const WORKFLOW_POLICIES = Object.freeze({
  "ci.yml": {
    required: ["pull_request", "workflow_call", "workflow_dispatch"],
    allowed: ["pull_request", "workflow_call", "workflow_dispatch"],
    branches: ["staging", "master"]
  },
  "container-images.yml": {
    required: ["workflow_call", "workflow_dispatch"],
    allowed: ["workflow_call", "workflow_dispatch"]
  },
  "deploy-staging.yml": {
    required: ["push", "workflow_dispatch"],
    allowed: ["push", "workflow_dispatch"],
    branches: ["staging"]
  },
  "promote-production.yml": {
    required: ["push", "workflow_dispatch"],
    allowed: ["push", "workflow_dispatch"],
    branches: ["master"]
  },
  "release-e2e.yml": {
    required: ["workflow_dispatch"],
    allowed: ["workflow_dispatch"]
  }
});

export function extractWorkflowTriggers(source, file = "<workflow>") {
  const lines = source.replace(/^\uFEFF/u, "").split(/\r?\n/u);
  const onLineIndex = lines.findIndex((line) =>
    /^(?:"on"|'on'|on)\s*:/u.test(line)
  );

  if (onLineIndex < 0) {
    throw new Error(`${file} does not define a top-level on: trigger.`);
  }

  const match = lines[onLineIndex].match(/^(?:"on"|'on'|on)\s*:\s*(.*?)\s*$/u);
  const inline = stripComment(match?.[1] ?? "").trim();

  if (inline) {
    return parseInlineTriggers(inline, file);
  }

  const triggers = [];
  let childIndent = null;

  for (let index = onLineIndex + 1; index < lines.length; index += 1) {
    const rawLine = lines[index];
    if (!rawLine.trim() || rawLine.trimStart().startsWith("#")) continue;

    const indent = rawLine.match(/^\s*/u)?.[0].length ?? 0;
    if (indent === 0) break;

    const keyMatch = rawLine.match(/^\s*([A-Za-z_][A-Za-z0-9_-]*)\s*:/u);
    if (!keyMatch) continue;

    if (childIndent === null) childIndent = indent;
    if (indent === childIndent) triggers.push(keyMatch[1]);
  }

  if (triggers.length === 0) {
    throw new Error(`${file} has an empty or unsupported top-level on: trigger.`);
  }

  return [...new Set(triggers)];
}

export function assertManualWorkflowSource(source, file = "<workflow>") {
  const triggers = extractWorkflowTriggers(source, file);
  const disallowed = triggers.filter((trigger) => trigger !== "workflow_dispatch");

  if (disallowed.length > 0) {
    throw new Error(
      `${file} must remain manual-only; disallowed top-level trigger(s): ${disallowed.join(", ")}.`
    );
  }

  if (!triggers.includes("workflow_dispatch")) {
    throw new Error(`${file} must define workflow_dispatch.`);
  }

  return triggers;
}

export function assertReleaseWorkflowSource(source, file = "<workflow>") {
  const name = basename(file);
  const policy = WORKFLOW_POLICIES[name];
  if (!policy) throw new Error(`${name} has no explicit release trigger policy.`);
  const triggers = extractWorkflowTriggers(source, file);
  const disallowed = triggers.filter((trigger) => !policy.allowed.includes(trigger));
  const missing = policy.required.filter((trigger) => !triggers.includes(trigger));
  if (disallowed.length > 0) {
    throw new Error(`${file} has disallowed top-level trigger(s): ${disallowed.join(", ")}.`);
  }
  if (missing.length > 0) {
    throw new Error(`${file} is missing required top-level trigger(s): ${missing.join(", ")}.`);
  }
  for (const branch of policy.branches || []) {
    if (!new RegExp(`branches:\\s*\\[[^\\]]*\\b${branch}\\b[^\\]]*\\]`, "u").test(source)) {
      throw new Error(`${file} must restrict its automatic trigger to branch ${branch}.`);
    }
  }
  return triggers;
}

export async function checkReleaseWorkflowDirectory(
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
    const triggers = assertReleaseWorkflowSource(source, file);
    checked.push({ file, triggers });
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
      throw new Error(`${file} has an empty inline on: trigger list.`);
    }
    return [...new Set(triggers)];
  }

  if (normalized.startsWith("{") && normalized.endsWith("}")) {
    const triggers = [...normalized.matchAll(/(?:^|,)\s*([A-Za-z_][A-Za-z0-9_-]*)\s*:/gu)]
      .map((match) => match[1]);
    if (triggers.length === 0) {
      throw new Error(`${file} has an unsupported inline on: mapping.`);
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
    const checked = await checkReleaseWorkflowDirectory(
      process.env.WORKFLOW_DIRECTORY || WORKFLOW_DIRECTORY
    );
    console.log(
      `Release workflow trigger guard passed for ${checked.length} workflow file(s).`
    );
  } catch (error) {
    console.error("Release workflow trigger guard failed:");
    console.error(`- ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
