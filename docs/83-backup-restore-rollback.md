# Backup, restore, and rollback operations

This runbook defines the BabyLoop PostgreSQL recovery and release rollback contract. It is designed for staging and production operations. It does not commit credentials, print database passwords, execute a database down migration, or silently overwrite a non-empty database.

## Safety model

- Backups use PostgreSQL custom format with compression, no owner, and no privilege restoration.
- Every artifact has a versioned JSON manifest, byte count, database fingerprint, Git SHA, migration head, and SHA-256 checksum.
- Production backups require `age` encryption and a second copy in `BACKUP_REPLICA_DIR` on a separate persistent volume or mounted backup sink.
- Restore verifies the manifest, checksum, artifact size, archive readability, and post-restore schema fingerprint.
- A non-empty target is refused unless destructive replacement has two explicit confirmations.
- Production restore requires an additional production-only confirmation.
- Restore smoke creates an isolated temporary database, restores the complete backup, validates it, and drops the database even after failure.
- Code rollback is forward-only for the database: no down migration is executed. Older code may run only when the current migration is explicitly declared compatible with the previous release.

## Required tools

Install compatible versions of:

- `pg_dump`
- `pg_restore`
- `psql`
- `createdb`
- `dropdb`
- `age` for encrypted production backup and restore

The backup command refuses a PostgreSQL server newer than the installed `pg_dump` major version.

## Local or staging backup

```bash
DATABASE_URL="postgresql://..." \
BACKUP_ENVIRONMENT=staging \
BACKUP_OUTPUT_DIR="/secure/babyloop/backups" \
BACKUP_ENCRYPTION_MODE=none \
BACKUP_RETENTION_DAYS=14 \
BACKUP_RETENTION_COUNT=7 \
pnpm ops:db:backup
```

The command prints only a safe host/database label and artifact metadata. It never prints the password or full connection URL.

## Production encrypted backup

```bash
DATABASE_URL="postgresql://..." \
BACKUP_ENVIRONMENT=production \
BACKUP_OUTPUT_DIR="/var/lib/babyloop/backups" \
BACKUP_REPLICA_DIR="/mnt/persistent-backup/babyloop" \
BACKUP_ENCRYPTION_MODE=age \
BACKUP_AGE_RECIPIENT="age1..." \
BACKUP_RETENTION_DAYS=30 \
BACKUP_RETENTION_COUNT=14 \
pnpm ops:db:backup
```

Store the private `age` identity outside the repository and outside the application container. The public recipient may be configured in the deployment secret manager. The replica directory must be a different mounted volume or backup sink from the primary output directory.

Each successful backup creates:

- `*.dump` or `*.dump.age`
- matching `*.manifest.json`

Retention deletes only complete, checksum-valid backup sets for the same environment and database. Invalid or partial files are never deleted automatically.

## Isolated restore smoke

Run this against `babyloop_test` or a staging clone before production release:

```bash
TEST_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test" \
pnpm ops:db:restore-smoke
```

The smoke test:

1. creates a temporary `babyloop_restore_smoke_*` database on the same PostgreSQL server,
2. creates a fresh backup,
3. verifies the manifest and SHA-256 checksum,
4. restores the archive,
5. compares table, column, and migration fingerprints,
6. runs `select 1`,
7. drops the temporary database with `--force`,
8. deletes temporary backup and receipt files.

Record the successful output as `BACKUP_RESTORE_SMOKE_EVIDENCE` for the release decision.

## Controlled restore

Restore to a new or empty database:

```bash
RESTORE_ARTIFACT_PATH="/secure/backups/babyloop-production-....dump.age" \
RESTORE_MANIFEST_PATH="/secure/backups/babyloop-production-....dump.age.manifest.json" \
RESTORE_DATABASE_URL="postgresql://.../babyloop_restore_target" \
RESTORE_ENVIRONMENT=staging \
RESTORE_CONFIRM=RESTORE_DATABASE \
BACKUP_AGE_IDENTITY_FILE="/run/secrets/babyloop-backup-age-key.txt" \
pnpm ops:db:restore
```

A destructive replacement additionally requires:

```bash
RESTORE_ALLOW_REPLACE=true
RESTORE_REPLACE_CONFIRM=<exact-target-database-name>
```

A production restore additionally requires:

```bash
RESTORE_ENVIRONMENT=production
RESTORE_PRODUCTION_CONFIRM=RESTORE_PRODUCTION_DATABASE
```

Before destructive production restore, stop writers, record the incident owner, take another verified backup when possible, and obtain manual go/no-go approval.

## Release manifest

A release manifest records immutable image digests, full Git SHA, migration head, database compatibility, and the verified pre-deploy backup manifest.

```bash
RELEASE_ENVIRONMENT=production \
RELEASE_API_IMAGE="registry.example/babyloop-api@sha256:..." \
RELEASE_WEB_IMAGE="registry.example/babyloop-web@sha256:..." \
RELEASE_BACKOFFICE_IMAGE="registry.example/babyloop-backoffice@sha256:..." \
RELEASE_BACKUP_MANIFEST_PATH="/mnt/backups/latest.dump.age.manifest.json" \
RELEASE_PREVIOUS_MANIFEST_PATH=".release/manifests/previous.json" \
RELEASE_DATABASE_FORWARD_COMPATIBLE=true \
pnpm ops:release:manifest
```

The command writes a manifest plus a checksum sidecar under `.release/manifests/`. Production image references must use immutable `@sha256:` digests.

## Rollback plan

```bash
ROLLBACK_CURRENT_MANIFEST_PATH=".release/manifests/current.json" \
ROLLBACK_TARGET_MANIFEST_PATH=".release/manifests/previous.json" \
ROLLBACK_ALLOW_FORWARD_SCHEMA=true \
pnpm ops:release:rollback
```

The rollback plan:

- verifies both manifest checksum files,
- rejects environment mismatch,
- rejects mutable image tags,
- rejects a target newer than the current release,
- keeps the current database schema,
- refuses changed migrations unless forward compatibility was explicitly declared,
- produces immutable service image targets and post-rollback verification steps.

Exact provider execution is delegated to a checked-in adapter under `scripts/deploy/adapters/`. Patch 15 will add the selected staging/production provider adapter. Arbitrary shell commands and external adapter paths are refused.

## Rollback execution contract

After the deployment adapter exists, execution also requires:

```bash
ROLLBACK_EXECUTE=true
ROLLBACK_CONFIRM="ROLLBACK_TO_<target-release-id>"
ROLLBACK_ADAPTER_PATH="scripts/deploy/adapters/<provider>.mjs"
```

The adapter receives only the verified rollback plan path. It must deploy the pinned API, web, and backoffice images, then run liveness, readiness, worker-heartbeat, metrics, and beta critical smoke checks.

## Release evidence checklist

Before production go/no-go, retain:

- encrypted primary backup artifact and manifest,
- checksum-verified replica copy,
- isolated restore smoke output,
- current and previous release manifests with checksum sidecars,
- rollback plan,
- migration compatibility review,
- post-deploy health and smoke output,
- named release owner and manual go/no-go record.

## Checksum-protected restore evidence

Restore smoke artık `restore_smoke` türünde Git SHA ve migration head bağlı bir evidence dosyası ile `.sha256` üretir. Production GO/NO-GO yalnızca staging acceptance ile aynı Git SHA'ya ait ve geçerlilik süresi dolmamış restore evidence kabul eder. `RESTORE_SMOKE_EVIDENCE_PATH` ile kalıcı evidence konumu belirlenir.
