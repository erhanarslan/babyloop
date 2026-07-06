# Mobile messaging/realtime parity boundary

Mobile messaging/realtime parity audit is the P0 release boundary for mobile messaging, realtime expectations, notification unread-count, message read-state, and logout/session cleanup parity.

Run:

pnpm security:mobile-messaging-realtime-parity

This audit verifies:

- API conversation list/detail/send/read-state boundaries remain covered.
- API participant access, block, and moderation fail-closed boundaries remain covered.
- API realtime socket auth, room join access control, persisted message publishing, and unread-count events remain covered.
- Web messaging and notification read-state surfaces remain visible for cross-surface parity.
- Mobile notification unread/read-state surfaces remain visible.
- Mobile logout/session cleanup expectation remains visible.
- Mobile messaging/realtime parity pending remains an explicit P0 gap until real mobile realtime messaging is implemented.
- Mobile P0 release gate includes this parity audit.
- Beta critical smoke includes this parity audit.

No-leak guarantees:

- Mobile messaging/realtime/read-state surfaces do not expose accessToken.
- Mobile messaging/realtime/read-state surfaces do not expose refreshToken.
- Mobile messaging/realtime/read-state surfaces do not expose passwordHash.
- Mobile messaging/realtime/read-state surfaces do not expose cookie.
- Mobile messaging/realtime/read-state surfaces do not expose authorization.

Release rule:

This audit does not implement mobile realtime messaging by itself. It prevents accidental release claims by requiring mobile messaging/realtime parity pending to remain explicit until the implementation and real-device smoke are completed.

Release dependency map:

- API: conversation, send, read-state, notification unread-count, realtime socket auth, and room access guards must pass.
- Web: read-state and notification unread surfaces remain the reference behavior.
- Mobile: notification unread/read-state is guarded now; mobile messaging/realtime parity pending is a P0 release blocker until implemented.
- Beta: beta critical smoke and release:mobile:p0 must both run pnpm security:mobile-messaging-realtime-parity.

Mobile messaging/realtime parity audit does not expose accessToken, does not expose refreshToken, does not expose passwordHash, does not expose cookie, and does not expose authorization in API, web, mobile, docs, logs, or storage surfaces.

Mobile messaging/realtime parity audit permits accessToken only as an internal realtime auth input or E2E helper value; it does not expose accessToken, does not expose refreshToken, does not expose passwordHash, does not expose cookie, and does not expose authorization through response DTOs, logs, or storage.
