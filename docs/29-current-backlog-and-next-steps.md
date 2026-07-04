# BabyLoop Current Backlog and Next Steps

This document is the active backlog summary after the mobile MFA/login-flow hardening and roadmap reset.

## Product direction

BabyLoop is a real product/ecosystem, not only a listing demo. The intended product is:

- safe baby/child marketplace,
- child-aware notebook/reminder/recommendation layer,
- messaging and trust/safety workflow,
- RAG/assistant as a marketing differentiator,
- realistic checkout/payment simulation until legal/company setup exists,
- mobile app completed alongside web,
- exhaustive test support because there is no separate QA team.

## P0 current priority

1. Repo hygiene and docs truth reset.
2. Auth security review.
3. Google OAuth hardening.
4. Production email provider foundation.
5. S3/R2 production image storage wiring.
6. Managed PostgreSQL migration plan.
7. Queue/job foundation.
8. Advanced filtering and pagination.
9. Realtime duplicate/missing/reconnect groundwork.
10. Legal pages: Terms of Use, Privacy Policy, marketplace rules on web and mobile.

## P1 product completion

1. Child notebook/reminders/lifecycle notifications end-to-end.
2. Notification delivery and n8n data pipeline.
3. Analytics/product-intelligence logging.
4. RAG/assistant production completion.
5. Fraud prevention signals.
6. Seller review/rating/review count.
7. Payment simulation and commission model.
8. Mobile app missing flows.
9. Messaging image attachments only.
10. Offline queue/reconnect behavior.

## P2 polish and QA

1. Full web UI/UX polish after all remaining features are complete.
2. Full mobile UI/UX polish after all remaining features are complete.
3. End-to-end manual QA pass.
4. Exhaustive automated test expansion.
5. Release smoke hardening.

## Final production package

1. Production managed PostgreSQL.
2. Production Redis.
3. Queue workers.
4. API/web/backoffice/mobile deployment pipeline.
5. Secrets management.
6. Observability: logs, metrics, error tracking, alerts.
7. Backup/restore and migration rollback.
8. Incident runbooks.
9. Cost monitoring.
10. Final production readiness and security pass.

## Explicitly removed from near-term backlog

- Non-core rental-style marketplace flows.
- Multi-admin operations workflows.
- Enterprise moderation workload tracking.
- Unsupported document-style message attachments.

## Payment direction

Real payment collection is intentionally disabled until there is a company/legal setup. The product still needs a realistic checkout simulation:

- order state machine,
- payment state machine,
- commission calculator,
- platform fee,
- seller net amount,
- buyer total amount,
- Iyzico-ready provider abstraction,
- webhook skeleton,
- demo/payment-disabled guard.

The goal is that later only real Iyzico API keys and legal setup remain.

## Testing direction

Testing must become exhaustive across API, web, backoffice, mobile, RAG, auth security, storage, queue/jobs, notifications, payment simulation, realtime, and fraud signals. Manual QA will still be performed by the owner, but the software must provide as much automated support as possible.
