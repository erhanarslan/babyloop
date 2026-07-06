# Auth/session/CSRF/realtime/read-state boundary

Auth/session/CSRF/realtime/read-state audit is the combined release boundary for public auth, backoffice auth, realtime membership, message read-state, notification unread-count, and release dependency mapping.

Run:

pnpm security:auth-session-realtime-readstate

This audit verifies:

- Public register/login/logout/refresh/auth-me flows stay covered.
- Auth/session cookies stay httpOnly and use SameSite/Secure production boundaries.
- Refresh/logout/session revoke behavior stays covered.
- Public access cookie migration remains guarded.
- Public mutation routes remain protected by CSRF.
- Backoffice cookie auth, CSRF, and admin route protection remain guarded.
- Realtime socket auth, conversation room joins, access control, and persisted-message publishing remain guarded.
- Logout/session cleanup remains tied to realtime disconnect or access revocation expectations.
- Messaging read-state remains explicit through read-state endpoints.
- Notification unread-count/read/read-all events remain reconciled with message read-state.
- Release dependency map keeps API, web, backoffice, and mobile boundaries visible.
- Mobile messaging/realtime parity pending remains an explicit P0 gap until implemented.

No-leak guarantees:

- Auth/session/realtime/read-state DTOs and docs do not expose accessToken.
- Auth/session/realtime/read-state DTOs and docs do not expose refreshToken.
- Auth/session/realtime/read-state DTOs and docs do not expose passwordHash.
- Auth/session/realtime/read-state DTOs and docs do not expose cookie.
- Auth/session/realtime/read-state DTOs and docs do not expose authorization.

Release dependency map:

- API: auth/session/cookie/CSRF/realtime/read-state/unread-count guards must pass.
- Web: auth/session/CSRF/read-state surfaces must keep cookie-based behavior and avoid token storage.
- Backoffice: admin auth/CSRF/RBAC surfaces must remain guarded before sensitive trust-and-safety actions.
- Mobile: SecureStore auth and notification/read-state surfaces stay guarded; mobile messaging/realtime parity pending is tracked separately.

This audit does not implement new realtime features by itself. It prevents regressions while keeping mobile messaging/realtime parity pending as an explicit future implementation item.

Auth/session/CSRF/realtime/read-state audit does not expose accessToken, does not expose refreshToken, does not expose passwordHash, does not expose cookie, and does not expose authorization in user-facing DTOs, docs, logs, web storage, or mobile storage.
