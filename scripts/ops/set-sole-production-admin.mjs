#!/usr/bin/env node
import { resolve } from "node:path";
import {
  loadEnvFile,
  runCommand,
  timestampForFile,
  writeJsonReceipt
} from "../deploy/deployment-lib.mjs";
import {
  assertProductionOperationGuard,
  executeSoleProductionAdminOperation,
  safeSoleProductionAdminError,
  SoleProductionAdminError
} from "./sole-production-admin-lib.mjs";
import { createSoleProductionAdminPostgresAdapter } from "./sole-production-admin-postgres.mjs";

let databaseClient;

try {
  const options = parseArguments(process.argv.slice(2));
  const loaded = await loadEnvFile(options.envFile);
  const environment = options.environment;
  const databaseUrl = loaded.values.DATABASE_URL;

  if (loaded.values.DEPLOY_ENVIRONMENT !== "production") {
    throw controlledError(
      "ENV_FILE_ENVIRONMENT_MISMATCH",
      "The explicit env file must contain DEPLOY_ENVIRONMENT=production."
    );
  }

  assertProductionOperationGuard({
    apply: options.apply,
    confirmation: process.env.ADMIN_BOOTSTRAP_CONFIRM,
    databaseUrl,
    environment
  });

  const [{ createDatabaseClient }, gitResult] = await Promise.all([
    import("@babyloop/database"),
    runCommand("git", ["rev-parse", "HEAD"], { capture: true })
  ]);
  databaseClient = createDatabaseClient({ databaseUrl });
  const adapter = createSoleProductionAdminPostgresAdapter(databaseClient.pool);

  const result = await executeSoleProductionAdminOperation({
    adapter,
    apply: options.apply,
    confirmation: process.env.ADMIN_BOOTSTRAP_CONFIRM,
    databaseUrl,
    environment,
    gitSha: gitResult.stdout.trim(),
    writeReceipt: async (receiptValue) => {
      const receiptPath = resolve(
        `.release/operations/sole-production-admin-${timestampForFile(new Date(receiptValue.timestamp))}.json`
      );
      return writeJsonReceipt(receiptPath, receiptValue);
    }
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  const safeError = safeSoleProductionAdminError(error);
  process.stderr.write(`${JSON.stringify({ ok: false, error: safeError })}\n`);
  process.exitCode = 1;
} finally {
  await databaseClient?.close().catch(() => undefined);
}

function parseArguments(argv) {
  let envFile = "";
  let environment = "";
  let apply = false;
  let dryRun = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--") continue;
    if (argument === "--apply") {
      apply = true;
      continue;
    }
    if (argument === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (argument === "--env-file") {
      envFile = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (argument.startsWith("--env-file=")) {
      envFile = argument.slice("--env-file=".length);
      continue;
    }
    if (argument.startsWith("--environment=")) {
      environment = argument.slice("--environment=".length);
      continue;
    }

    throw controlledError("ARGUMENT_INVALID", "Only the documented fixed-target operation flags are accepted.");
  }

  if (!envFile) {
    throw controlledError("ENV_FILE_REQUIRED", "--env-file is required and is never inferred.");
  }
  if (environment !== "production") {
    throw controlledError("ENVIRONMENT_MISMATCH", "--environment must be exactly production.");
  }
  if (apply && dryRun) {
    throw controlledError("MODE_CONFLICT", "--apply and --dry-run cannot be combined.");
  }

  return { apply, envFile, environment };
}

function controlledError(code, message) {
  return new SoleProductionAdminError(code, message);
}
