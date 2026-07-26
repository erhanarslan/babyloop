const CLOUD_RUN_JOB_RESERVED_ENV_NAMES = new Set([
  "PORT",
]);

export function stripCloudRunJobReservedEnv(source) {
  const filtered = String(source)
    .split(/\r?\n/u)
    .filter((line) => {
      const match = line.match(
        /^([A-Za-z_][A-Za-z0-9_]*)\s*:/u,
      );

      return (
        !match
        || !CLOUD_RUN_JOB_RESERVED_ENV_NAMES.has(match[1])
      );
    })
    .join("\n")
    .replace(/\n+$/u, "");

  return `${filtered}\n`;
}
