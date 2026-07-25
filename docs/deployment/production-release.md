# Production release

## Normal release

1. Confirm the desired staging SHA passed `Deploy staging` and its smoke artifact is retained.
2. Open a release PR from `staging` to `master`.
3. Wait for `Release gate` and review the release diff.
4. Merge with a merge commit. Do not squash.
5. `Promote production` starts from the protected `master` push.
6. Required reviewers approve the `production` GitHub Environment.
7. The workflow verifies the staging parent SHA and identical Git tree, then resolves the already-built staging image digests. It never rebuilds.
8. Database preflight and encrypted backup must pass before migration.
9. Migration postflight, rollout and production smoke must pass before a dated tag/GitHub Release is created.

## Manual emergency release

Dispatch `Promote production` from `master` and provide the full accepted staging SHA if it cannot be inferred. The workflow still enforces:

- master ref;
- production Environment reviewers;
- `PRODUCTION_RELEASE_APPROVED=true`;
- SHA membership in `origin/staging`;
- no tree difference between the staging SHA and master;
- exact existing staging digests;
- backup, migration guards and smoke.

This is a rerun mechanism, not a branch-protection bypass.

## Backup verification

The backup command checks PostgreSQL client/server compatibility, creates a custom-format checksum-protected artifact, verifies it, applies retention and requires the production encryption policy from the runtime contract. Evidence is uploaded in `production-release-<staging-sha>`. Periodically run the isolated restore smoke from `docs/83-backup-restore-rollback.md`; a backup that has never been restored is not a complete disaster-recovery proof.

## Release commands

Release creation is normally GitHub-driven:

```bash
git fetch origin
git switch staging
git pull --ff-only origin staging
gh pr create --base master --head staging --title "release: promote BabyLoop production"
```

After merge, approve the production Environment in GitHub. The workflow creates a tag shaped like `babyloop-vYYYY.MM.DD.N`.
