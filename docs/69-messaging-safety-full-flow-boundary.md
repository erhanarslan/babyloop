# Messaging safety full-flow boundary

Messaging safety full-flow boundary is the release guard for the public messaging chain: conversation start, message send, moderation, blocking, realtime event delivery, notification side effects, and backoffice conversation review.

Run:

pnpm security:messaging-safety-full-flow

This boundary verifies:

- unsafe message bodies are rejected before persistence, notification creation, and realtime publish;
- valid Turkish and multiline plaintext messages remain accepted after safe trimming;
- non-participants cannot read conversations, list messages, join realtime rooms, or send messages;
- blocked or restricted profiles cannot start or continue messaging flows;
- realtime join requires authenticated access and conversation membership;
- realtime messageCreated and conversationUpdated payloads are built from safe public DTOs;
- conversation list/detail responses do not expose email, phone, accessToken, refreshToken, passwordHash, cookie, authorization, or raw auth/session data;
- admin conversation review uses bodyPreview and redacted contact previews by default;
- sensitive message body access remains behind explicit admin sensitive-access permission, reason, and audit;
- web messaging safety smoke still covers blocked send UX.

This does not add a new realtime provider, does not add a new chat system, does not expose email, does not expose phone, does not expose accessToken, does not expose refreshToken, does not expose cookie, does not expose authorization, and does not weaken redaction. Existing Socket.IO and current API contracts remain the only covered messaging surfaces.
