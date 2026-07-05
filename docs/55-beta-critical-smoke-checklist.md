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
