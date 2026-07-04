# BabyLoop Current Task Map and Roadmap

This is the active task map. Older enterprise-ops and unsupported attachment assumptions are superseded.

## Completed / strong foundation

- Monorepo and workspace tooling.
- Fastify API foundation.
- Public web foundation.
- Dedicated backoffice foundation.
- Expo mobile foundation.
- Auth/register/login/logout/refresh/me.
- Password reset and email verification foundation.
- Google OAuth foundation.
- MFA email OTP backend and mobile flow foundation.
- Mobile security settings with password modal.
- Mobile client channel enforcement.
- Web login approval via active mobile session.
- Listings core.
- Local listing image upload/review foundation.
- Favorites.
- Messaging and realtime foundation.
- Notifications foundation.
- Reports/blocking.
- Backoffice trust/safety foundation.
- Child profiles, notes, reminders foundation.
- RAG/assistant foundation.
- Mock cart/checkout foundation.
- API/web/backoffice/mobile test foundations.

## Active P0 sequence

1. Repo hygiene and docs truth reset.
2. Auth security review.
3. Google OAuth hardening.
4. Production email provider.
5. S3/R2 production storage wiring.
6. Managed Postgres migration planning.
7. Queue/job foundation.
8. Advanced filtering and pagination.
9. Realtime hardening groundwork.
10. Web/mobile legal surfaces.

## Active P1 sequence

1. Child notebook/reminders/lifecycle completion.
2. Notification delivery and n8n automation.
3. Product analytics/logging.
4. RAG/assistant production completion.
5. Fraud prevention.
6. Seller reviews and review counts.
7. Payment simulation and commission model.
8. Mobile app completion.
9. Image-only message attachments.
10. Offline/reconnect support.

## Final polish

UI/UX polish happens after feature completion:

- web home/search/browse/detail/sell/messages/notifications/child/assistant/cart/account,
- mobile equivalent flows,
- copy/i18n,
- empty/loading/error states,
- logo/pattern/icon set,
- report/block menu visibility.

## Final DevOps package

The final production package includes managed DB, Redis, workers, deployment, secrets, monitoring, backups, alerts, runbooks, and final security/readiness checks. S3 bucket setup exists; the rest of production infrastructure still needs completion.
