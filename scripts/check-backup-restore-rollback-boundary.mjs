import { existsSync, readFileSync } from "node:fs";

const problems = [];
const requiredFiles = [
  "scripts/ops/postgres-ops-lib.mjs",
  "scripts/ops/postgres-backup.mjs",
  "scripts/ops/postgres-restore.mjs",
  "scripts/ops/postgres-restore-smoke.mjs",
  "scripts/ops/release-ops-lib.mjs",
  "scripts/ops/release-manifest.mjs",
  "scripts/ops/release-rollback.mjs",
  "scripts/ops/test/postgres-ops.test.mjs",
  "scripts/ops/test/release-rollback.test.mjs",
  "docs/83-backup-restore-rollback.md",
  ".env.example",
  "package.json"
];

for (const file of requiredFiles) {
  if (!existsSync(file)) problems.push(`Missing backup/restore/rollback file: ${file}`);
}
const read = (file) => readFileSync(file, "utf8");
const must = (source, file, token) => {
  if (!source.includes(token)) problems.push(`${file} must contain ${JSON.stringify(token)}.`);
};
const mustNot = (source, file, token) => {
  if (source.includes(token)) problems.push(`${file} must not contain ${JSON.stringify(token)}.`);
};

if (problems.length === 0) {
  const backup = read("scripts/ops/postgres-backup.mjs");
  for (const token of [
    "--format=custom", "--compress=9", "--no-owner", "--no-privileges",
    "BACKUP_ENCRYPTION_MODE=age", "BACKUP_REPLICA_DIR", "BACKUP_AGE_RECIPIENT",
    "sha256File", "writeJsonAtomic", "enforceBackupRetention", "assertPgDumpCompatibility"
  ]) must(backup, "scripts/ops/postgres-backup.mjs", token);

  const restore = read("scripts/ops/postgres-restore.mjs");
  for (const token of [
    "verifyBackupArtifact", "RESTORE_CONFIRM", "RESTORE_PRODUCTION_CONFIRM",
    "RESTORE_ALLOW_REPLACE", "RESTORE_REPLACE_CONFIRM", "--list", "--exit-on-error",
    "assertFingerprint", "keep_current_schema"
  ]) {
    if (token === "keep_current_schema") continue;
    must(restore, "scripts/ops/postgres-restore.mjs", token);
  }

  const smoke = read("scripts/ops/postgres-restore-smoke.mjs");
  for (const token of ["TEST_DATABASE_URL", "createdb", "dropdb", "--force", "postgres-backup.mjs", "postgres-restore.mjs"]) {
    must(smoke, "scripts/ops/postgres-restore-smoke.mjs", token);
  }

  const rollback = read("scripts/ops/release-rollback.mjs");
  const rollbackLib = read("scripts/ops/release-ops-lib.mjs");
  for (const token of ["keep_current_schema", "ROLLBACK_ALLOW_FORWARD_SCHEMA", "ROLLBACK_CONFIRM", "scripts/deploy/adapters", "sha256:"]) {
    must(`${rollback}\n${rollbackLib}`, "release rollback scripts", token);
  }
  mustNot(rollback, "scripts/ops/release-rollback.mjs", "shell: true");
  mustNot(backup, "scripts/ops/postgres-backup.mjs", "console.log(process.env)");
  mustNot(restore, "scripts/ops/postgres-restore.mjs", "console.log(process.env)");

  const pkg = JSON.parse(read("package.json"));
  const scripts = pkg.scripts ?? {};
  for (const [name, token] of Object.entries({
    "ops:db:backup": "postgres-backup.mjs",
    "ops:db:restore": "postgres-restore.mjs",
    "ops:db:restore-smoke": "postgres-restore-smoke.mjs",
    "ops:release:manifest": "release-manifest.mjs",
    "ops:release:rollback": "release-rollback.mjs",
    "test:ops:backup-restore": "node --test",
    "security:backup-restore-rollback": "check-backup-restore-rollback-boundary.mjs"
  })) must(scripts[name] ?? "", `package.json#${name}`, token);
  must(scripts["test:api:security"] ?? "", "package.json#test:api:security", "pnpm security:backup-restore-rollback");

  const env = read(".env.example");
  for (const token of ["BACKUP_ENVIRONMENT", "BACKUP_OUTPUT_DIR", "BACKUP_REPLICA_DIR", "BACKUP_ENCRYPTION_MODE", "BACKUP_AGE_RECIPIENT", "BACKUP_RETENTION_DAYS", "BACKUP_RETENTION_COUNT"]) {
    must(env, ".env.example", token);
  }

  const doc = read("docs/83-backup-restore-rollback.md");
  for (const token of ["restore smoke", "age", "SHA-256", "forward-only", "no down migration", "manual go/no-go"]) {
    must(doc.toLowerCase(), "docs/83-backup-restore-rollback.md", token.toLowerCase());
  }
}

if (problems.length) {
  console.error("Backup/restore/rollback boundary guard failed:");
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}
console.log("Backup/restore/rollback boundary guard passed.");
