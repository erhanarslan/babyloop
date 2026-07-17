# Backoffice Analytics Metrics

Backoffice analytics is aggregate-first.

Definitions:

- DAU: distinct authenticated users with at least one meaningful analytics event on a calendar day.
- Chat user: distinct user with `conversation_opened`, `conversation_started`, or `message_sent`.
- Listing view: `listing_opened` after client-side duplicate debounce.
- Engaged time: visible/focused/foreground heartbeat deltas.
- Google-linked user: user with a real `auth_accounts.provider = 'google'` relation.
- Verified user: user with `users.emailVerifiedAt` set.

Current-state auth counts come from database snapshots, not client event counts. Event trends show activity over time, but they are not the authority for current verified users or provider-linked users.
