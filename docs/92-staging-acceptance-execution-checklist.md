# 92 — Staging Acceptance Execution Checklist

## A. Host and container posture

- [ ] Host security updates applied
- [ ] Docker and Compose v2 installed
- [ ] Runtime user has only required Docker permissions
- [ ] `/etc/babyloop` mode is `700`
- [ ] Runtime/release env files mode is `600`
- [ ] Backup, replica and evidence directories are mounted and persistent
- [ ] Ports 3000, 3001 and 4000 bind only to loopback
- [ ] Container images are digest-pinned
- [ ] `docker compose config --quiet` passes
- [ ] Container labels contain the expected full Git SHA
- [ ] Container logs have rotation limits

## B. Runtime configuration

- [ ] Runtime env audit is `passed`
- [ ] No placeholder remains
- [ ] Auth secret is unique and at least 32 characters
- [ ] Push token encryption key is unique and at least 32 characters
- [ ] Database connection uses managed PostgreSQL and TLS
- [ ] Redis uses `rediss://`
- [ ] R2 endpoint and public CDN domain are distinct
- [ ] CORS contains only staging public web and backoffice origins
- [ ] Legal operator/contact fields contain final public values

## C. Deployment

- [ ] Fresh backup receipt created
- [ ] Release manifest created
- [ ] Migration job completed once
- [ ] API became ready
- [ ] Web and backoffice health checks passed
- [ ] Notification worker heartbeat is fresh
- [ ] Child-reminder worker heartbeat is fresh
- [ ] No stale notification claims are present
- [ ] Deployment acceptance evidence is checksum-protected

## D. Real providers

- [ ] R2 upload/read/delete round trip passed
- [ ] Resend email arrived and content was reviewed
- [ ] Expo push arrived on the Galaxy S22
- [ ] Qdrant active alias/collection returned expected results
- [ ] Redis ping passed through API readiness
- [ ] Live RAG acceptance passed
- [ ] Analytics event/rollup smoke passed
- [ ] Error webhook received a controlled test event
- [ ] Provider probe evidence is `passed`

## E. Product smoke

- [ ] Register, verify email and login
- [ ] Google login
- [ ] MFA OTP
- [ ] Web-login mobile approval
- [ ] Session revocation
- [ ] Listing create/edit/archive/sold/reserved
- [ ] Listing images load from CDN
- [ ] Browse infinite scroll reaches later pages
- [ ] Favorites
- [ ] Messaging realtime/read state
- [ ] Report/block
- [ ] Child notebook/reminder
- [ ] Assistant grounding and safety refusal
- [ ] Basket and simulated checkout
- [ ] Backoffice moderation and audit visibility

## F. Performance evidence

- [ ] API acceptance p50/p95 within configured thresholds
- [ ] Listing JSON payload within configured byte limit
- [ ] Web HTML within configured byte limit
- [ ] Galaxy S22 cold start recorded
- [ ] Long listing scroll has no growing memory leak
- [ ] Messaging long list remains responsive
- [ ] Background/foreground recovery does not duplicate requests
- [ ] No hidden-tab polling/timer regression

## G. GO/NO-GO

- [ ] Runtime env audit evidence
- [ ] Staging bootstrap plan
- [ ] Live provider probe evidence
- [ ] Staging acceptance evidence
- [ ] Restore-smoke evidence
- [ ] Signed mobile evidence
- [ ] Signed provider evidence
- [ ] All evidence uses the same full Git SHA
- [ ] All checksums verify
- [ ] Evidence is younger than `GO_NO_GO_MAX_AGE_HOURS`
- [ ] Production GO receipt generated
