# Mobile real-device S22 QA checklist

This checklist is the manual release gate for BabyLoop mobile on a physical Samsung Galaxy S22. It is not a replacement for automated API/web/backoffice tests; it covers Android device behavior that cannot be trusted from browser responsive mode or emulator-only checks.

## Scope

- Device: Samsung Galaxy S22 physical device.
- Platform: Android real-device build.
- Network: Wi-Fi and mobile data where available.
- Accounts: at least one buyer account, one seller account, and one account with child profile data.
- Backend: local/staging API with known seed data.
- Backoffice: available for moderation/storage/notification ops verification.

## Preconditions

- [ ] API, web, backoffice, and mobile build versions are recorded.
- [ ] Test account credentials are recorded in a private local note, not committed.
- [ ] No real production credentials, real n8n webhook, push provider secret, SMS provider, or payment secret are used.
- [ ] `pnpm qa:mobile:s22` passes before starting manual QA.
- [ ] `pnpm test:api:security`, `pnpm security:auth-leaks`, and `pnpm release:artifacts` pass before beta release.
- [ ] A screen recording is enabled for failure reproduction when practical.

## Install and launch

- [ ] Fresh install launches without crash.
- [ ] App cold start reaches the expected initial screen.
- [ ] App restart preserves only expected session state.
- [ ] App uninstall/reinstall clears local auth/session state.
- [ ] App works after Android force stop and relaunch.

## Android safe-area and navigation behavior

- [ ] Bottom tab stays at the physical bottom when Android navigation buttons/gesture bar are hidden.
- [ ] Bottom tab is pushed above Android navigation buttons/gesture bar when they appear.
- [ ] No unusable reserved space remains below the bottom tab.
- [ ] Header, scroll views, and primary CTA buttons remain tappable with Android gesture navigation.
- [ ] Keyboard open/close does not hide primary form actions.
- [ ] Landscape mode is either blocked intentionally or renders without broken layout.

## Auth, OTP, and session

- [ ] Register succeeds with valid user data.
- [ ] Register validation errors are readable and not clipped.
- [ ] Login succeeds with valid credentials.
- [ ] Login failure does not leak whether email/password was wrong beyond intended copy.
- [ ] Logout disconnects realtime sessions and returns to public state.
- [ ] Session refresh survives app restart.
- [ ] Expired session returns to login without crash.
- [ ] OTP/MFA required response is handled on mobile.
- [ ] OTP/MFA success path completes and returns user to intended screen.
- [ ] OTP/MFA invalid/expired code path shows controlled error.
- [ ] Security notification/preference entry point is visible where expected.

## Browse, search, and listing detail

- [ ] Browse loads newest listings.
- [ ] Search input works with Turkish characters.
- [ ] Filters apply without losing scroll unexpectedly.
- [ ] Listing cards keep stable image/card dimensions.
- [ ] Listing detail opens from browse.
- [ ] Seller safe summary is shown without email/phone leakage.
- [ ] Reserved listings remain visible/messageable where intended.
- [ ] Empty states are readable.

## Sell listing and image upload

- [ ] Create listing form opens.
- [ ] Required-field validation works.
- [ ] Category/condition/listing type selections are tappable.
- [ ] Price and city fields work with Android keyboard.
- [ ] Camera image upload works if supported.
- [ ] Gallery image upload works.
- [ ] Max image count is enforced.
- [ ] Image reorder/delete works.
- [ ] Unsafe/invalid image errors are controlled.
- [ ] Submit success navigates to expected state.
- [ ] Drafting/cancel/back behavior does not lose data unexpectedly.

## Favorites

- [ ] Favorite add works from list/detail.
- [ ] Favorite remove works from list/detail.
- [ ] Favorites screen reflects state after refresh/restart.
- [ ] Unauthenticated favorite action routes to login and returns safely.

## Messaging and realtime

- [ ] Buyer can start a conversation from listing detail.
- [ ] Seller sees conversation in list.
- [ ] New message appears in thread.
- [ ] Thread open marks messages as read.
- [ ] Unread count updates.
- [ ] Socket reconnect after app background/foreground does not duplicate messages.
- [ ] Moderation rejection is shown before sending unsafe text.
- [ ] Blocked user/message flow behaves as intended.

## Reports and block

- [ ] Listing report is reachable but not overexposed on cards.
- [ ] Message report is reachable from message context.
- [ ] Profile/block action is reachable from appropriate menu.
- [ ] Blocked profiles list/state updates.
- [ ] Block prevents message flow according to API policy.

## Child profiles, notes, reminders, and notification readiness

- [ ] Child profile list loads.
- [ ] Create/update/deactivate child profile works if the UI is present.
- [ ] Child-specific notebook/reminder entry point is visible when child data exists.
- [ ] Reminder candidate UI copy does not imply real push/email/n8n delivery unless the sender is actually enabled.
- [ ] Notification ops readiness remains draft-only: push sender disabled, n8n workflow disabled, webhook disabled, queue disabled.
- [ ] Age/development-stage recommendation copy avoids medical, diagnosis, drug, treatment, diet, or therapy claims.

## Offline, poor network, and recovery

- [ ] App shows controlled errors when API is unavailable.
- [ ] Retry works after network returns.
- [ ] No infinite spinner on failed requests.
- [ ] App background/foreground during network failure recovers.
- [ ] Duplicate submits are prevented or safely idempotent.

## Performance and stability

- [ ] Cold start feels acceptable on Galaxy S22.
- [ ] Browse scrolling does not visibly jank under seeded listings.
- [ ] Listing image loading does not freeze UI.
- [ ] Memory pressure/background relaunch does not crash.
- [ ] No obvious console/log leak of tokens, cookies, OTP, email, phone, or raw message body.

## Accessibility and usability

- [ ] Tap targets are usable with one hand.
- [ ] Text is readable in default Android font size.
- [ ] Error messages are visible above keyboard.
- [ ] Primary actions are not color-only.
- [ ] Turkish copy is understandable and consistent.

## Security/privacy manual checks

- [ ] Access token, refresh token, OTP, cookie, password, email, phone, and raw message body do not appear in UI/debug logs.
- [ ] Logout clears sensitive local state.
- [ ] Unauthenticated users cannot open protected screens by deep/back navigation.
- [ ] Admin/backoffice-only concepts do not appear in public mobile UI except safe status copy.
- [ ] No production secrets are present in mobile config.

## Pass/fail template

Use this template for each beta run:

```text
Device:
Android version:
Build/version:
API base URL:
Tester:
Date/time:

Pass:
Fail:
Blocked:
Regression risk:
Screenshots/recordings:
Follow-up issue links:
Release decision: go / no-go
```

## Release decision

A beta build cannot be considered ready if any of these fail:

- Auth/session/OTP/MFA critical path.
- Browse/listing detail.
- Sell listing with image upload.
- Messaging send/read path.
- Android bottom tab safe-area behavior.
- Security/privacy log leakage check.
- Notification readiness copy falsely implying real push/n8n delivery.

## Mobile OTP/MFA hardening

- [ ] `pnpm security:mobile-otp-mfa-hardening` passes before the physical Galaxy S22 QA run.
- [ ] OTP required response is handled on mobile.
- [ ] Valid OTP verification refreshes session state.
- [ ] Invalid OTP, expired OTP, rate limit, resend, and network recovery states are visible and controlled.
- [ ] Logout cleanup clears sensitive state.
- [ ] OTP/token/cookie/password values are not logged.
- [ ] Mobile OTP/MFA hardening evidence is attached to the QA record.

## SecureStore mobile auth check

- [ ] SecureStore or equivalent secure device storage is used for sensitive mobile auth/session material.
- [ ] OTP/token/cookie/password values are not logged in console output, analytics, crash reports, screenshots, or notification payloads.
- [ ] Mobile OTP/MFA hardening evidence is attached to the Galaxy S22 QA record.

## Child notebook/reminder hardening

- [ ] `pnpm security:child-notebook-reminder-hardening` passes before mobile child notebook QA.
- [ ] Mobile child notebook free note create/edit/delete is tested.
- [ ] Mobile recurring reminder create/edit/delete is tested.
- [ ] Mobile advance reminder one week before and one day before is tested.
- [ ] Mobile reminder time selection is tested.
- [ ] Mobile complete/cancel/snooze is tested.
- [ ] Mobile notification preference link is tested.
- [ ] Mobile child notebook does not provide medical/therapy/diagnosis/drug/diet advice.

Exact guard wording: web child notebook coverage must stay aligned with mobile child notebook QA.

## Notification preference QA

- [ ] `pnpm security:notification-preference-qa` passes before mobile notification preferences QA.
- [ ] Mobile notification preferences are visible.
- [ ] Push opt-out is visible.
- [ ] Child reminder preference is visible.
- [ ] Saved search preference is visible.
- [ ] Child lifecycle preference is visible.
- [ ] Disabled preference state is explained.
- [ ] Consent required state is explained.
- [ ] Rate limit state is explained.
- [ ] Blocked user safety state is explained.
- [ ] Manual QA evidence is attached.

## Notification preference QA cross-surface evidence

- Exact guard wording: backoffice notification preferences.

- Exact guard wording: audit.

- Exact guard wording: raw contact logging.
