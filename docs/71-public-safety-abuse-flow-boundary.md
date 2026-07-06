# Public safety abuse-flow boundary

Public safety abuse-flow audit is the release boundary for report/block/moderation behavior across public API, web, mobile, and backoffice review surfaces.

Run:

pnpm security:public-safety-abuse-flow

This audit verifies:

- Message, listing, and profile report surfaces exist and stay authenticated.
- Block/unblock behavior blocks unsafe or unwanted messaging paths.
- Messaging pre-send moderation remains fail-closed for unsafe text.
- Plaintext validation rejects script/HTML/control-character abuse before persistence.
- Public safety actions stay hidden behind a menu/kebab-style affordance instead of being over-prominent on cards.
- Backoffice review uses admin redaction by default.
- Sensitive access requires reason, fields, admin authorization, and audit.
- Admin moderation and conversation review do not bypass redaction by default.
- Mobile safety surface pending remains explicitly tracked until mobile report/block UI is implemented.

No-leak guarantees:

- Public safety DTOs and default admin review DTOs do not expose email.
- Public safety DTOs and default admin review DTOs do not expose phone.
- Public safety DTOs and default admin review DTOs do not expose accessToken.
- Public safety DTOs and default admin review DTOs do not expose refreshToken.
- Public safety DTOs and default admin review DTOs do not expose passwordHash.
- Public safety DTOs and default admin review DTOs do not expose cookie.
- Public safety DTOs and default admin review DTOs do not expose authorization.
- Public safety DTOs and default admin review DTOs do not expose raw message body.

Release rule:

Public safety abuse-flow audit must pass before claiming messaging, reporting, blocking, moderation, or admin trust-and-safety release readiness. It does not add new provider calls, does not add external moderation providers, does not expose private contact data, and does not make mobile report/block complete by implication. Mobile safety surface pending is an explicit gap until implemented.

Public safety abuse-flow audit does not expose email, does not expose phone, does not expose accessToken, does not expose refreshToken, does not expose passwordHash, does not expose cookie, does not expose authorization, and does not expose raw message body in public safety or default admin review DTOs.
