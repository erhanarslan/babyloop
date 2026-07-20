# R2, marketplace email, and listing image policy runbook

This runbook covers the production controls added for Cloudflare R2 image storage,
message/favorite email preferences, and listing-image product policy enforcement.
Never commit real credentials to the repository.

## 1. Cloudflare R2 image storage

Use an R2 S3 API endpoint for authenticated operations and a public/custom domain
for returned image URLs. They are intentionally different values.

```dotenv
IMAGE_STORAGE_DRIVER=s3
IMAGE_STORAGE_PUBLIC_BASE_URL=https://images.example.com
S3_BUCKET=babyloop-listings
S3_REGION=auto
S3_ENDPOINT=https://ACCOUNT_ID.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_FORCE_PATH_STYLE=true
```

The API development and smoke commands automatically load the repository-root
`.env.local` file when it exists. Run the temporary write/read/delete smoke below.
The command creates one object under `smoke/r2-connectivity/` and deletes it in a
`finally` block.

```bash
IMAGE_STORAGE_R2_SMOKE_ALLOW_WRITE=true \
pnpm --filter @babyloop/api storage:smoke:r2
```

The output exposes only the endpoint/public host names. It never prints the bucket
name or credentials.

## 2. Email delivery

Marketplace notification email reuses the verified Resend configuration used by
authentication email. An optional notification-specific switch or sender can still
override the shared values.

```dotenv
EMAIL_DELIVERY_MODE=provider
EMAIL_SEND_ENABLED=true
EMAIL_PROVIDER=resend
EMAIL_FROM=BabyLoop <no-reply@example.com>

RESEND_FROM_NAME=BabyLoop
RESEND_API_KEY=...
RESEND_API_BASE_URL=https://api.resend.com
WEB_APP_URL=https://example.com
```

`EMAIL_FROM` (or the optional `RESEND_FROM_EMAIL` override) must use a verified Resend sender/domain. A
message/favorite event creates an idempotent delivery candidate only when the user
has enabled its email preference. Sending is then performed by the existing worker:

```bash
pnpm --filter @babyloop/api notifications:process
```

Schedule that worker at a short, regular interval in the production job runner.
Only verified recipient email addresses are sent. Message bodies are never copied
into delivery metadata or email content.

For a controlled provider smoke, set `NOTIFICATION_SMOKE_RECIPIENT_EMAIL` to an
address you own and run:

```bash
NOTIFICATION_SMOKE_CHANNELS=email \
pnpm --filter @babyloop/api notifications:smoke:providers
```

To test the actual message and listing-favorite email templates against an
existing, verified BabyLoop account, first enable both email toggles in that
account's notification settings. Then run the explicit two-email smoke below.
The command reads the repository-root `.env.local` file automatically when it
exists.
It executes only the two candidates it creates and never drains unrelated
pending notification rows:

```bash
NOTIFICATION_MARKETPLACE_SMOKE_CONFIRM_SEND=true \
NOTIFICATION_SMOKE_RECIPIENT_EMAIL=you@example.com \
pnpm --filter @babyloop/api notifications:smoke:marketplace-email
```

The command refuses to send when the recipient is missing/unverified, either
preference is disabled, `WEB_APP_URL` is not an absolute HTTPS URL, or Resend is
not fully enabled. Its output redacts the recipient and never prints provider
credentials.

## 3. Listing-image product policy

Production must use the Gemini authenticity provider:

```dotenv
LISTING_IMAGE_AUTHENTICITY_PROVIDER=gemini
GEMINI_API_KEY=...
GEMINI_LISTING_IMAGE_AUTHENTICITY_MODEL=gemini-2.5-flash
```

The provider evaluates whether the upload is a real, listing-relevant product photo
and emits prohibited-product signals. Server-side deterministic policy is applied
after the provider response, so a provider `allow` cannot override a high-confidence
prohibited-product detection.

| Signal | Action |
| --- | --- |
| Prohibited product, confidence at least 0.85 | Reject before object storage |
| Possible prohibited product below 0.85 | Store as hidden `needs_review` and queue moderation |
| Sensitive child content, high confidence | Reject before object storage |
| Non-product or unrelated image, high confidence | Reject before object storage |
| Uncertain real/relevant product photo | Store as hidden `needs_review` |
| Real, relevant, policy-safe product photo | Approve and store in R2 |
| Provider unavailable in production | Fail closed; do not store |

Policy codes and the policy version are retained in AI run flags for audit. Public
listing responses continue to hide images in `needs_review` or rejected states.

## 4. Release checks

```bash
node scripts/check-deployment-readiness.mjs --target=production
pnpm --filter @babyloop/api typecheck
pnpm --filter @babyloop/web typecheck
pnpm --filter @babyloop/mobile typecheck
```

Do not enable the production switches until the R2 smoke, Resend smoke, full tests,
and a manual preference opt-in/opt-out check have passed.
