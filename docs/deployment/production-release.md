# Production release

For the first cutover, use this exact order:

1. Merge the single-environment patch from its topic branch into `staging`.
2. Wait for the staging validation workflow to pass.
3. Prepare GitHub `production` Environment variables/secrets, including the current-runtime identifier inventory.
4. Verify WIF/IAM for that Environment and `promote-production.yml`.
5. Prepare the production runtime contract without deploying it.
6. Pre-create mappings from `babyloop.com.tr`, `api.babyloop.com.tr`, and `admin.babyloop.com.tr` to the existing web, API, and backoffice services.
7. Add the returned Cloudflare DNS-only records.
8. Wait for all three managed certificates to report `True`.
9. Verify HTTP/TLS responses from all three production domains on the existing services.
10. Add the production API callback URI to the Google OAuth client.
11. Merge the `staging` → `master` release PR.
12. Let `Deploy production` deploy the production configuration from protected `master`.
13. Require mandatory production smoke to pass.
14. Only then remove the `staging.*` mappings and DNS records.

The live read-only production rehearsal enforces step 9 before any workflow mutation. Domain mapping remains a manual cutover prerequisite; the workflow does not mutate mappings.

During step 12 the workflow audits runtime and identifier continuity, builds immutable images in `babyloop-staging/europe-west1/babyloop-images`, captures traffic, performs database preflight and encrypted backup, executes the idempotent migration, updates existing resources, and records evidence only after smoke succeeds.

Manual dispatch is only a rerun from `master`; it does not accept a staging SHA and cannot bypass Environment approval, topology/project guards, backup, migration checks or smoke.

Potentially destructive migrations are blocked by default. Supply the exact temporary review confirmation only for a reviewed pending migration and remove it afterward.
