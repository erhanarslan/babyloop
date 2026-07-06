# Beta Critical Smoke Checklist

This checklist defines the minimum manual QA path before a BabyLoop beta demo or staging release.

## Scope

This is not a full regression suite. It is the minimum smoke path to catch broken auth, listing, messaging, upload, assistant, notification, and backoffice flows.

## 1. Public web shell

- Home page renders.
- Header search submits to browse.
- Browse page renders latest listings.
- Category landing pages render.
- Listing cards show stable image frames.
- Mobile viewport does not break header, listing grid, or listing detail layout.
- Footer and core navigation links work.

## 2. Auth

- Register succeeds.
- Login succeeds.
- Logout clears visible user state.
- `/auth/me` returns current user after login.
- Protected pages redirect or prompt correctly when logged out.
- Password reset request shows safe non-enumerating behavior.
- Email verification dev/sandbox flow does not expose secrets.
- MFA-required response path does not break login UI even if MFA is not fully enabled.

## 3. Listings

- Create listing with required fields.
- Create listing with 1 image.
- Create listing with 5 images.
- 6th image is rejected.
- Invalid image type is rejected.
- Oversized image is rejected.
- Listing detail renders images.
- My listings renders owner listing.
- Owner can update title/price.
- Owner can change status: active/reserved/sold/archived according to allowed transitions.
- Public listing DTO does not expose seller email, phone, user id, or private profile data.

## 4. Image storage

- Local driver serves `/api/v1/uploads/listings/...`.
- S3/R2 driver config preview does not expose credentials.
- Backoffice storage ops preview loads.
- Listing images continue to render when URL is absolute `https://...`.
- Rejected image is hidden publicly and visible in backoffice review.

## 5. Favorites

- Logged-in user can favorite listing.
- User can unfavorite listing.
- Favorites page reflects current state.
- Favorite notification must not expose who favorited the listing to the seller in a privacy-risky way.

## 6. Messaging

- Buyer can start message to seller.
- Seller can open conversation.
- Sending plain text works.
- Script/HTML payload is rejected or safely sanitized.
- Open thread marks messages as read.
- Unread count decreases after thread open/read.
- Realtime update does not leak another user’s conversation.

## 7. Reports and block

- User can report listing.
- User can report profile.
- User can report message.
- User can block profile.
- Blocked profile cannot continue unsafe interaction.
- Report/block UI is not overly exposed on listing cards.

## 8. Assistant / RAG

- Assistant page loads.
- Marketplace/product discovery question returns useful answer.
- Child-needs question returns safe non-medical guidance.
- Assistant does not provide diagnosis.
- Assistant does not provide medication dosage.
- Assistant does not provide treatment plan.
- Assistant does not provide diet prescription.
- Assistant suggests marketplace-safe next actions.
- RAG citations/context do not leak internal docs or secrets.

## 9. Child profiles

- Create child profile.
- Update child profile.
- Deactivate/activate child profile.
- Lifecycle recommendations render.
- Child profile data is not exposed publicly.
- Notification cadence setting is reflected in notification preview/drafts.

## 10. Saved searches and notifications

- Create saved search from browse.
- Toggle saved search notifications on/off.
- Notification preferences page loads.
- Delivery drafts preview loads.
- Backoffice notification ops preview loads.
- Delivery policy remains draft-only.
- No real email/push/n8n delivery is triggered in beta unless a dedicated release enables it.

## 11. Backoffice auth and trust/safety

- Backoffice login works.
- Non-admin user cannot access admin endpoints.
- Moderation case list loads.
- Moderation case detail loads.
- Listing review page loads.
- Image approve/reject works.
- Sensitive access requires reason.
- Audit timeline records admin actions.
- Redaction is default.
- Backoffice does not store access tokens in localStorage/sessionStorage.

## 12. Email provider

- Admin email ops preview loads.
- Admin email test-send returns sandbox result unless SMTP send kill-switch is explicitly enabled.
- Provider config preview does not expose SMTP password or Resend API key.
- Default/sandbox mode keeps `sendEnabled=false`; real SMTP sending is allowed only when `EMAIL_DELIVERY_MODE=provider`, `EMAIL_PROVIDER=smtp`, and `EMAIL_SEND_ENABLED=true`.
- Verification/reset flows do not try to send real email unless explicitly enabled in a later release.

## 13. Observability and logs

- API logs do not contain passwords, refresh tokens, access tokens, email verification tokens, reset tokens, OTP codes, raw message body, or private child profile data.
- Upload errors are visible enough to debug but do not expose server file paths unnecessarily.
- Assistant provider failures return safe fallback errors.

## 14. Abuse/security smoke

- XSS payload in listing title/description is rejected or rendered safely.
- XSS payload in message body is rejected or rendered safely.
- SQL-like input in search does not break API.
- Unauthorized listing update returns 401/403.
- Unauthorized image delete returns 401/403.
- Admin endpoints reject public user.
- CSRF-protected mutation without token/cookie fails where applicable.
- Rate limits are active on high-risk endpoints or explicitly tracked as a beta blocker.

## 15. Release decision

Beta can proceed only if:

- Auth, listing create/detail, image upload, messaging, favorites, reports, assistant, and backoffice moderation smoke paths pass.
- No known critical P0/P1 security issue remains open.
- Secrets are not committed.
- Production storage plan is not local ephemeral disk.
- RAG medical/safety boundaries pass manual prompts.
- Backoffice audit/redaction remains intact.

### Upload abuse and public media cache boundary

- [ ] `pnpm security:upload-storage-boundary` passes.
- [ ] Oversized listing image upload returns a safe 413/`IMAGE_TOO_LARGE` response.
- [ ] Invalid image type and MIME/extension/magic-byte mismatch return safe 400 responses.
- [ ] Sixth listing image is rejected before storage.
- [ ] Local uploaded images include `Cache-Control: public, max-age=31536000, immutable`.
- [ ] S3/R2 public media base URL is HTTPS in staging/production.
- [ ] Storage ops preview does not expose bucket credentials, object storage secrets, raw object keys beyond safe public URLs, or raw image binary data.
- [ ] Dedicated per-profile/per-IP upload frequency quotas are either implemented or explicitly tracked as a beta blocker.

### Listing image authenticity provider boundary

- [ ] `pnpm security:image-authenticity` passes.
- [ ] `LISTING_IMAGE_AUTHENTICITY_PROVIDER=mock` is rejected for production readiness.
- [ ] `LISTING_IMAGE_AUTHENTICITY_PROVIDER=unavailable` is rejected for production readiness.
- [ ] `LISTING_IMAGE_AUTHENTICITY_PROVIDER=gemini` requires `GEMINI_API_KEY` or `GOOGLE_API_KEY`.
- [ ] Upload with provider `reject` returns a safe `IMAGE_AUTHENTICITY_REJECTED`.
- [ ] Upload with provider unavailable returns a safe `IMAGE_AUTHENTICITY_UNAVAILABLE`.
- [ ] AI Ops and listing image review must show safe metadata only: provider, model, prompt version, confidence, decision, reasons, safe flags, and status.
- [ ] No raw image bytes, base64, raw provider output, raw prompt, API key, token, cookie, password hash, seller email/phone, or raw user/profile object appears in API responses or backoffice UI.

### Cross-listing duplicate image boundary

- [ ] `pnpm security:cross-listing-duplicates` passes.
- [ ] A same listing duplicate image upload is rejected with a safe duplicate-image error.
- [ ] Duplicate-image responses do not expose `contentHash`, `content_hash`, `sha256`, object keys, storage credentials, or raw image bytes.
- [ ] The DB unique constraint is scoped to `(listing_id, content_hash)`.
- [ ] Cross-listing duplicate image use is not claimed as production fraud detection until seller context, listing history, time window, perceptual hash/provider signal, audit, and appeal boundaries exist.

### Mobile OTP/MFA P0 boundary

- [ ] `pnpm security:mobile-auth` passes.
- [ ] `pnpm test:mobile:p0` passes.
- [ ] Mobile login can enter the MFA-required state and complete with a 6-digit e-mail OTP.
- [ ] MFA-required state does not authenticate or store a token until OTP verification succeeds.
- [ ] Mobile security settings use current-password modal confirmation for e-mail OTP and mobile approval toggles.
- [ ] Mobile approval is for web login approval; mobile login must not require mobile approval for itself.
- [ ] Mobile auth token storage uses SecureStore, not AsyncStorage/localStorage/sessionStorage.
- [ ] Mobile session and login approval UI do not render token-like values, refresh tokens, password hashes, OTP hashes, cookies, or raw auth/session objects.
- [ ] Logout clears mobile auth token state and disconnects realtime.

### Mobile P0 release gate

- [ ] `pnpm release:mobile:p0` passes.
- [ ] The gate includes `pnpm security:mobile-auth`, `pnpm test:mobile:p0`, and `pnpm --filter @babyloop/mobile typecheck`.
- [ ] The gate does not run Maestro and does not claim real-device QA.
- [ ] Mobile OTP/MFA P0 boundary still passes: SecureStore token storage, MFA-required unauthenticated state, current-password security toggles, mobile approval for web login approval, and safe session/login approval rendering.
- [ ] Real-device S22 manual QA is still tracked separately.

### Mobile notification boundary

- [ ] `pnpm security:mobile-notifications` passes.
- [ ] `pnpm release:mobile:p0` includes the mobile notification boundary guard.
- [ ] Mobile notifications list/unread/read/read-all flows work through authenticated mobile fetch.
- [ ] Mobile notification cards do not expose tokens, refresh tokens, password hashes, cookies, raw session payloads, or raw e-mail values.
- [ ] Child lifecycle notification generation is in-app only and does not claim email/push/n8n delivery.
- [ ] Child reminder notification cadence remains preference/draft-only until the delivery-log/idempotency package is implemented.
- [ ] Real email/push/n8n delivery is not claimed in beta.

### Notification delivery log foundation

- [ ] `pnpm security:notification-delivery-log` passes.
- [ ] Notification delivery candidate logs use a unique idempotency key.
- [ ] Frequency window behavior blocks duplicate candidate writes.
- [ ] Candidate log metadata is safe and does not contain raw e-mail, token, OTP, password, cookie, authorization, or raw body values.
- [ ] The delivery-log foundation keeps `deliveryAllowed=false` and `draftOnly=true`.
- [ ] No email/push/n8n sender is enabled by this foundation.

### Child reminder delivery candidate pipeline

- [ ] `pnpm security:child-reminder-delivery` passes.
- [ ] Scheduled reminders create candidate log records only; completed/cancelled reminders are skipped.
- [ ] Child reminder candidates use `kind=child_reminder`.
- [ ] The pipeline keeps `deliveryAllowed=false` and `draftOnly=true`.
- [ ] Metadata stays safe and does not include raw child description, e-mail, token, OTP, password, cookie, authorization, or raw body values.
- [ ] No email/push/n8n sender is enabled by this pipeline.

### Saved-search delivery candidate pipeline

- [ ] `pnpm security:saved-search-delivery` passes.
- [ ] Saved-search/listing matches create candidate log records only.
- [ ] Candidate source ids remain stable across savedSearchId/listingId pairs.
- [ ] The pipeline keeps `deliveryAllowed=false` and `draftOnly=true`.
- [ ] Metadata stays safe and does not include raw e-mail, token, OTP, password, cookie, authorization, or raw body values.
- [ ] No email/push/n8n sender is enabled by this pipeline.

### Notification delivery-log ops preview

- [ ] `pnpm security:notification-ops-preview` passes.
- [ ] Backoffice notification ops preview shows aggregate delivery-log counts.
- [ ] Recent rows use redacted source refs only.
- [ ] Metadata, idempotency key, dedup key, e-mail, token, cookie, authorization, and raw body values are not shown.
- [ ] No email/push/n8n sender, queue, or provider call is enabled by the preview.

### Notification delivery transition model

- [ ] `pnpm security:notification-delivery-transitions` passes.
- [ ] Backoffice notification ops preview shows draft-only transition rules.
- [ ] Candidate/block/skip flows are allowed only as draft-only operational states.
- [ ] `sent/failed` remains blocked until provider sandbox, retry/dead-letter policy, idempotency, and admin audit are complete.
- [ ] No email/push/n8n sender, queue, webhook, or provider call is enabled by this model.

### Native push readiness

- [ ] `pnpm security:notification-push-readiness` passes.
- [ ] Backoffice notification ops preview shows native push readiness.
- [ ] Push sender is visibly blocked and draft-only.
- [ ] Token registry and token collection remain disabled.
- [ ] Expo/Firebase/APNs provider calls, queues, n8n hooks, webhooks, or senders are not enabled.

### n8n workflow readiness

- [ ] `pnpm security:notification-n8n-readiness` passes.
- [ ] Backoffice notification ops preview shows n8n workflow readiness.
- [ ] Webhook and queue/worker remain disabled.
- [ ] Child lifecycle, child reminder, and saved-search remain candidate sources only.
- [ ] No n8n webhook, queue worker, provider call, email, push, or real workflow trigger is enabled.

### Mobile real-device S22 QA

- [ ] `pnpm qa:mobile:s22` passes.
- [ ] Physical Galaxy S22 run is completed using `docs/56-mobile-real-device-s22-qa-checklist.md`.
- [ ] OTP/MFA and auth/session critical path passes.
- [ ] Browse/detail/sell listing/image upload/favorites/messaging paths pass.
- [ ] Android bottom tab safe-area behavior passes.
- [ ] Push sender disabled and n8n workflow disabled copy remains accurate.
- [ ] No token/cookie/OTP/password/email/phone/raw body leakage is observed.

### Storage ops preview

- [ ] `pnpm security:storage-ops-preview` passes.
- [ ] Backoffice storage ops preview shows external storage provider disabled.
- [ ] S3/R2 provider, signed upload, bucket delete, object copy, CDN purge, and queue worker remain disabled.
- [ ] Storage preview does not expose object keys, bucket credentials, signed URLs, tokens, cookies, raw upload body, EXIF metadata, email, or phone.

### Assistant safety guard

- [ ] `pnpm security:assistant-safety-guard` passes.
- [ ] Medical diagnosis, medication/dosage advice, treatment plans, diet prescriptions, and therapy claims are blocked.
- [ ] Hallucination guard requires grounding/source IDs for specific claims.
- [ ] Everyday parenting checklist/routine/comfort support remains available.
- [ ] Raw child data, raw message body, email, phone, token, cookie, OTP, password, and authorization values are not exposed.

### Full beta critical smoke automation

- [ ] `pnpm security:beta-critical-smoke` passes.
- [ ] `pnpm beta:critical-smoke` passes.
- [ ] Assistant safety guard passes.
- [ ] Storage ops preview passes.
- [ ] Mobile real-device S22 QA checklist guard passes and physical QA evidence is recorded.
- [ ] Notification readiness guards pass.
- [ ] `security:auth-leaks` and `release:artifacts` pass.
- [ ] The gate does not enable push sender, n8n workflow, S3/R2 external storage, or autonomous RAG answers.

### Deployment readiness gate

- [ ] `pnpm security:deployment-readiness` passes.
- [ ] `pnpm beta:critical-smoke` includes deployment readiness gate.
- [ ] Staging and production environment variables are documented.
- [ ] Secrets, database migration, rollback, observability, health checks, and manual go/no-go approval are documented.
- [ ] The gate does not deploy or create cloud resources.
- [ ] AWS, Kubernetes, S3/R2, Redis, n8n, push, email, payment, and production database access remain disabled until explicit implementation.

### Public auth cookie migration

- [ ] `pnpm security:public-auth-cookie-migration` passes.
- [ ] `pnpm beta:critical-smoke` includes public auth cookie migration.
- [ ] httpOnly, sameSite, secure cookie, CSRF, refresh token, logout, session refresh, protected routes, MFA/OTP, favorites, messaging, and rollback are documented.
- [ ] Manual QA must cover register, login, refresh, logout, MFA/OTP, favorites, messaging, and protected routes.
- [ ] Runtime auth behavior remains unchanged until explicit implementation.

### Notification sender provider design gate

- [ ] `pnpm security:notification-sender-provider-design` passes.
- [ ] `pnpm beta:critical-smoke` includes notification sender provider design gate.
- [ ] Provider selection, sandbox, consent, rate limit, retry, dead-letter, audit, observability, and rollback are documented.
- [ ] Manual approval is required before enabling real notification sender.
- [ ] Draft-only notification readiness remains honest until provider rollout.
- [ ] Real email sending, real push sending, real n8n workflow triggering, provider credentials, webhook calls, and queue jobs remain disabled.

### Notification observability taxonomy

- [ ] `pnpm security:notification-observability-taxonomy` passes.
- [ ] `pnpm beta:critical-smoke` includes notification observability taxonomy.
- [ ] Event taxonomy, privacy-safe dimensions, metrics, dashboard plans, raw payload logging boundary, and PII restrictions are documented.
- [ ] Forbidden fields are not logged.
- [ ] Metrics exporters, tracing exporters, provider calls, queue jobs, webhook calls, real email sending, real push sending, and real n8n workflow triggering remain disabled.

### Notification consent/preference policy

- [ ] `pnpm security:notification-consent-preference` passes.
- [ ] `pnpm beta:critical-smoke` includes notification consent/preference policy.
- [ ] Consent, preference, opt-out, audit, rate limit, blocked user safety, mute/snooze, and source/channel scopes are documented.
- [ ] Raw contact logging remains disabled.
- [ ] Real sending, provider calls, queue jobs, webhook calls, and unconsented delivery remain disabled.

### Mobile OTP/MFA hardening

- [ ] `pnpm security:mobile-otp-mfa-hardening` passes.
- [ ] `pnpm beta:critical-smoke` includes mobile OTP/MFA hardening.
- [ ] SecureStore, OTP, MFA, rate limit, session refresh, logout cleanup, protected route return, network recovery, and Galaxy S22 QA are documented.
- [ ] OTP/token/cookie/password values must not be logged.
- [ ] Manual Galaxy S22 QA evidence is required before beta release.

### Child notebook/reminder hardening

- [ ] `pnpm security:child-notebook-reminder-hardening` passes.
- [ ] `pnpm beta:critical-smoke` includes child notebook/reminder hardening.
- [ ] Free note, recurring reminder, advance reminder, notification preference, web child notebook, mobile child notebook, complete/cancel/snooze, and owner-only access are documented.
- [ ] Runtime child notebook/reminder flows are manually QA'd before beta.
- [ ] Medical/therapy/diagnosis/drug/diet advice remains blocked.

### Notification preference QA

- [ ] `pnpm security:notification-preference-qa` passes.
- [ ] `pnpm beta:critical-smoke` includes notification preference QA.
- [ ] Backoffice notification preferences, mobile notification preferences, web notification preferences, opt-out, audit, rate limit, blocked user safety, and manual QA evidence are documented.
- [ ] Raw contact logging remains disabled.
- [ ] Manual QA evidence is required before beta release.

- Mobile notification preference screen-state QA must pass through `pnpm test:mobile:p0` and `pnpm security:mobile-notifications`; it does not require Maestro/device execution.

- Mobile child notebook/reminder screen-state QA must pass through `pnpm test:mobile:p0` and `pnpm security:child-notebook-reminder-hardening`; Maestro/S22 real-device execution remains separate.

- Release artifact guard UX: `pnpm release:artifacts` reports tracked generated artifacts separately from untracked/filesystem artifacts. Use `pnpm release:clean` for cleanable artifacts and `git rm` for tracked generated artifacts; do not bypass this guard in beta/release flows.\n
### CI Mobile P0 parity

- [ ] `.github/workflows/ci.yml` includes the device-free `mobile-p0` job.
- [ ] CI runs `pnpm security:ci-mobile-p0-parity` before `pnpm release:mobile:p0`.
- [ ] CI Mobile P0 parity does not run Maestro, does not require ADB, does not start Expo, and does not claim real-device QA.

### Child reminder API scheduling boundary

- [ ] `pnpm beta:critical-smoke` includes `pnpm security:child-reminder-api-schedule`.
- [ ] `pnpm security:child-reminder-api-schedule` passes.
- [ ] Future reminders use `reminder_not_due`; invalid dates use `reminder_invalid_date`.
- [ ] The guard does not run queue jobs, does not send email, does not send push, and does not trigger n8n.

### Image upload/review storage boundary

- [ ] pnpm beta:critical-smoke includes pnpm security:image-upload-review-storage.
- [ ] pnpm security:image-upload-review-storage passes.
- [ ] Public listing responses hide rejected and needs-review images.
- [ ] Admin listing detail shows safe image review metadata only.
- [ ] API responses do not expose objectKey, filePath, contentHash, credentials, tokens, raw provider output, raw upload body, base64 image data, storageDriver, uploadRoot, or local absolute paths.
- [ ] This does not enable S3/R2 rollout.

### Messaging safety full-flow boundary

- [ ] pnpm beta:critical-smoke includes pnpm security:messaging-safety-full-flow.
- [ ] pnpm security:messaging-safety-full-flow passes.
- [ ] Unsafe message bodies are rejected before persistence, notification creation, and realtime publish.
- [ ] Non-participants and blocked profiles cannot bypass send/read/realtime access.
- [ ] Admin conversation review uses redacted bodyPreview by default.
- [ ] Public/realtime/admin DTOs do not expose email, phone, accessToken, refreshToken, cookie, authorization, passwordHash, or raw auth/session data.
- [ ] This does not add a new realtime provider.

Messaging safety full-flow boundary does not expose email, does not expose phone, does not expose accessToken, does not expose refreshToken, does not expose cookie, and does not expose authorization in public, realtime, or admin default DTOs.

Image upload/review storage boundary does not expose objectKey, does not expose filePath, and does not expose contentHash in public or admin API responses.

## Notification surface consistency audit

Run pnpm security:notification-consistency-audit before claiming notification release readiness.

This broad audit covers API, web, mobile, and backoffice notification surfaces. It requires deliveryAllowed=false, draftOnly=true, email/push/n8n disabled copy, notification preferences, delivery drafts, push readiness, n8n readiness, observability, and manual QA boundaries to stay aligned.

This audit does not enable real email sending, does not enable real push sending, and does not enable real n8n workflow triggering. It does not enable queues, provider calls, webhook calls, native push token collection, or production notification delivery.

## Public safety abuse-flow audit

Run pnpm security:public-safety-abuse-flow before claiming report/block/moderation release readiness.

This audit covers report/block/moderation, fail-closed messaging safety, hidden menu public safety actions, admin redaction, sensitive access, and audit readiness across API, web, mobile, and backoffice surfaces.

Public safety and default admin review DTOs do not expose email, do not expose phone, do not expose accessToken, do not expose refreshToken, do not expose passwordHash, do not expose cookie, do not expose authorization, and do not expose raw message body.

Mobile safety surface pending remains an explicit tracked gap until mobile report/block UI is implemented.

Public safety abuse-flow audit does not expose email, does not expose phone, does not expose accessToken, does not expose refreshToken, does not expose passwordHash, does not expose cookie, does not expose authorization, and does not expose raw message body in public safety or default admin review DTOs.
