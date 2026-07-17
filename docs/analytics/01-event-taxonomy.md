# Product Analytics Event Taxonomy

BabyLoop analytics uses semantic first-party product events, not DOM click capture or session replay.

The shared taxonomy lives in `packages/shared/src/analytics-events.ts`. Web and mobile clients must use the same event names and event-specific property allowlist.

Events never include password, access token, refresh token, approval token, MFA challenge token, CSRF token, cookie, authorization header, email body, message body, child note body, reminder body/title, full assistant prompt, raw RAG source text, image base64, signed URL, exact IP, or client-supplied user id.

Server authoritative events are preferred for completed business actions such as registration, login, listing creation, message sent, saved search creation, child reminder creation, and checkout completion. Client events are used for navigation, engagement heartbeat, impressions, and non-blocking product intent signals.
