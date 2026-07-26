const CLOUD_RUN_JOB_RESERVED_ENV_NAMES = new Set([
  "PORT",
  "K_SERVICE",
  "K_REVISION",
  "K_CONFIGURATION",
  "CLOUD_RUN_JOB",
  "CLOUD_RUN_EXECUTION",
  "CLOUD_RUN_TASK_INDEX",
  "CLOUD_RUN_TASK_ATTEMPT",
  "CLOUD_RUN_TASK_COUNT",
]);

function isCloudRunReservedEnvName(name) {
  return (
    CLOUD_RUN_JOB_RESERVED_ENV_NAMES.has(name)
    || name.startsWith("X_GOOGLE_")
  );
}

export function stripCloudRunJobReservedEnv(source) {
  const filtered = String(source)
    .split(/\r?\n/u)
    .filter((line) => {
      const match = line.match(
        /^([A-Za-z_][A-Za-z0-9_]*)\s*:/u,
      );

      return (
        !match
        || !isCloudRunReservedEnvName(match[1])
      );
    })
    .join("\n")
    .replace(/\n+$/u, "");

  return `${filtered}\n`;
}
