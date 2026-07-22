# BabyLoop Google Cloud Run target

This directory defines the second deployment target for BabyLoop. It does not replace the hardened Docker Compose/Caddy target.

Core constraints:

- staging and production use different Google Cloud projects;
- all mutations require an environment-specific confirmation token;
- Cloud Run services scale to zero and are capped at one instance for the initial beta;
- runtime identities are separate for API, web, backoffice, jobs, and Scheduler;
- provider secrets are imported from a chmod-600 runtime env file into Secret Manager without printing values;
- secret versions are pinned in deployment manifests instead of using `latest`;
- images are Linux/AMD64, digest-pinned, and stored in regional Artifact Registry;
- migration is a private, unscheduled Cloud Run Job;
- notification and reminder processors are private Cloud Run Jobs invoked by authenticated Cloud Scheduler jobs;
- the default `run.app` URL remains enabled because Scheduler and release smoke checks depend on it.

## Scheduler IAM repair

Early Patch 22 bootstrap output may contain a project-level
`roles/run.invoker` binding for `babyloop-scheduler-invoker`. Remove it before
secret import or deployment:

```bash
GCP_IAM_REPAIR_CONFIRM=IAM_REPAIR_STAGING pnpm gcp:cloud-run:iam:repair -- --environment=staging

pnpm gcp:cloud-run:iam:audit -- --environment=staging
```

After jobs are deployed, only the scheduled notification and child-reminder
jobs receive resource-level invocation access. The migration job remains
unavailable to Scheduler.
