# Mobile Production Evidence

This document tracks BabyLoop mobile production evidence for the full production readiness track.

## Status

Current status: pending owner real-device run.

Automated gates exist and must pass before manual evidence is accepted. Manual Galaxy S22 evidence is separate from Jest/typecheck because Expo runtime, push delivery, Android navigation, keyboard behavior, camera/gallery permissions, and realtime socket behavior need a physical device.

## Automated mobile production gates

- pnpm --filter @babyloop/mobile typecheck
- pnpm test:mobile:p0
- pnpm release:mobile:p0
- pnpm qa:mobile:s22
- git diff --check

## Deterministic keyboard/composer guard

The Android conversation composer offset calculation is guarded by:

- apps/mobile/src/features/messages/conversation-keyboard-model.ts
- apps/mobile/src/features/messages/conversation-keyboard-model.test.ts

The guard covers:

- hidden keyboard composer position above the tab bar
- Android keyboard viewport resize overlap
- Android stable offset fallback when the raw offset jumps
- iOS fixed keyboard gap
- message list bottom padding reserved for the floating composer

## Galaxy S22 production smoke checklist

Record the exact values before marking this complete:

- Device: Galaxy S22
- Android version:
- Build type: EAS development build / preview build / production build
- Build version:
- API base URL:
- Web base URL:
- Tester:
- Date:

### Auth and security

- [ ] Fresh install opens without crash.
- [ ] Login succeeds.
- [ ] Logout succeeds.
- [ ] OTP/MFA required response is handled on mobile.
- [ ] Mobile login approval toggle is visible.
- [ ] Web login approval request appears on authenticated mobile session.
- [ ] Approve web login from mobile succeeds.
- [ ] Deny web login from mobile blocks the web login.
- [ ] Session list loads.
- [ ] Revoking another session removes it.
- [ ] Current session revoke logs out safely.
- [ ] Access token, refresh token, OTP, cookie, password, email, phone, and raw session objects do not appear in UI/debug logs.

### Push and notifications

- [ ] Push permission prompt is handled.
- [ ] Push token registration succeeds.
- [ ] Login approval push arrives.
- [ ] In-app notification list loads.
- [ ] Mark read / mark all read works.
- [ ] Notification preferences screen opens.
- [ ] External child/saved-search email, n8n, and generic push delivery are not claimed unless provider gates are explicitly enabled and tested.

### Marketplace

- [ ] Browse loads listings.
- [ ] Search/filter works.
- [ ] Listing detail opens.
- [ ] Favorite as guest redirects to login.
- [ ] Favorite after login works.
- [ ] Own listing does not show invalid buyer actions.
- [ ] Short link/share flow returns a clean /s/<code> URL.

### Sell and edit listing

- [ ] Sell screen opens.
- [ ] Camera image upload works if supported.
- [ ] Gallery image upload works.
- [ ] Max image count guard works.
- [ ] Listing create succeeds.
- [ ] My listings loads.
- [ ] Listing lifecycle actions work: reserve, sold, archive, restore where allowed.
- [ ] Edit listing opens owner detail even for inactive owner listings.
- [ ] Edit title/description/price works.
- [ ] Edit image add/delete/reorder works.
- [ ] Public listing only exposes approved public image behavior.

### Messaging and realtime

- [ ] Messages list loads.
- [ ] Conversation detail opens.
- [ ] Listing context appears in conversation detail.
- [ ] Android keyboard opens without covering composer.
- [ ] Last message remains visible above composer.
- [ ] Sending a message succeeds.
- [ ] Receiving realtime message updates the thread.
- [ ] Socket reconnect after app background/foreground does not duplicate messages.
- [ ] Composer remains usable after keyboard hide/show cycle.

### Child notebook and reminders

- [ ] Child-specific notebook/reminder entry point is visible when child data exists.
- [ ] Child profile loads or default profile is created.
- [ ] Note create/update/archive works.
- [ ] Reminder create/update/complete/cancel works.
- [ ] Interval, weekly, one-time, and appointment reminder forms validate correctly.
- [ ] Age/development-stage recommendation copy avoids medical, diagnosis, drug, treatment, diet, or therapy claims.

### Basket and checkout demo

- [ ] Add to basket works.
- [ ] Basket opens.
- [ ] Mock checkout success works.
- [ ] Mock checkout failure state is understandable.
- [ ] UI clearly avoids claiming real payment collection until provider/legal setup is enabled.

### Assistant

- [ ] Assistant opens only for authenticated user if required.
- [ ] Safe marketplace/parenting prompt returns bounded answer.
- [ ] Medical, diagnosis, drug, treatment, diet, or therapy request returns boundary response.
- [ ] Assistant does not expose raw RAG payloads, tokens, or internal prompt data.

## Release decision

- [ ] Go
- [ ] No-go

Decision notes:

Pending.
