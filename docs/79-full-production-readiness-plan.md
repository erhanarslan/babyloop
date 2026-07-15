# Full Production Readiness Plan

BabyLoop'un hedefi artık beta/release-candidate değil, full production seviyesine kapanıştır.

Bu planın amacı eksikleri tek tek kapatmak, production blocker alanları tamamlamak ve web/mobile/API/backoffice/devops bütününü gerçek ürün seviyesine taşımaktır.

## Production target

BabyLoop production-ready kabul edilmeden önce aşağıdaki alanlar tamamlanmış olmalıdır:

- Public web marketplace ana akışları
- Mobile app ana akışları
- API güvenlik, validation, audit ve rate-limit kapıları
- Backoffice Trust & Safety ve operasyon ekranları
- Production image storage
- Payment/checkout production-ready simulation
- Notification delivery worker/ops modeli
- RAG/assistant product-level UX ve safety
- Staging/prod deployment pipeline
- Observability, logging, backup/restore, rollback
- Legal/policy/demo/payment copy
- Full validation evidence

## Current production posture

| Area | Status | Production gap |
| --- | --- | --- |
| Public web marketplace | Strong foundation | Final UX polish, legal pages, payment/storage production copy |
| API marketplace core | Strong foundation | Payment state machine, storage rollout, production ops hardening |
| Mobile app | Strong foundation | Real-device evidence, Android composer/keyboard verification, release pipeline |
| Backoffice | Strong foundation | Payment/order ops, delivery log drilldown, granular operational views |
| Child notebook/reminders | Strong foundation | Web/mobile parity smoke, delivery worker/ops integration |
| Notifications/push | Partially productionized | Login approval push complete; general delivery processor/worker/ops must be hardened |
| RAG/assistant | Product foundation | Source UX, eval evidence, production Qdrant/Redis/runbook |
| Payment/checkout | Demo foundation | Commission, payment attempts, webhook seam, backoffice ops, disabled/live guards |
| Storage | Development-ready | S3/R2 production rollout, bucket policy, migration, CDN/cache, cleanup |
| DevOps/deploy | Not production-ready | Staging/prod infra, secrets, observability, backups, rollback |

## Hard no-go blockers

Production launch is blocked if any of these remain unresolved:

- Listing images are stored only in local development storage without an explicit production storage path.
- Payment flow lacks realistic state, commission, provider seam, webhook skeleton, and backoffice visibility.
- Real money collection is enabled without legal/company/payment-provider readiness.
- Mobile app lacks current real-device smoke evidence.
- Push/login approval/session revocation are not verified on real device.
- Notification delivery workers/providers can send without preference, audit, retry, and failure controls.
- RAG/assistant can answer without safety boundaries, source/fallback behavior, and usage limits.
- No staging/prod deploy pipeline exists.
- No backup/restore and rollback runbook exists.
- No production logging/error tracking/health monitoring exists.
- Public legal/policy pages are missing.
- Current release validation output is not recorded.

## Production sprint order

### Sprint 1: Production truth reset

Goal: Align repo docs and roadmap with full production target.

Deliverables:

- README update
- Full production readiness plan
- Known issues register
- Go/no-go checklist
- Current validation command bundle
- Old beta/deferred wording cleanup

### Sprint 2: Mobile production evidence

Goal: Prove mobile core flows on real Android device.

Deliverables:

- Galaxy S22 smoke evidence
- Push/login approval evidence
- Session revoke evidence
- Listing create/edit/image evidence
- Messages realtime evidence
- Child notebook/reminder evidence
- Basket/checkout demo evidence
- Assistant safety evidence
- Android composer/keyboard fix if still reproducible

### Sprint 3: Payment/checkout production-ready simulation

Goal: Make payment architecture production-ready without collecting real money yet.

Deliverables:

- Commission calculator
- Platform fee / seller net / buyer total
- Payment table or payment-attempt model
- Payment state machine
- Order state machine
- Refund/cancel simulation
- Iyzico-ready provider interface
- Webhook skeleton
- Backoffice order/payment ops
- API/web/mobile/backoffice tests
- Clear disabled/sandbox/live guards

### Sprint 4: Production image storage

Goal: Replace local-only upload risk with production storage path.

Deliverables:

- S3/R2 provider config
- Bucket policy
- Object key strategy
- CDN/cache decision
- Existing local file migration plan
- Upload cleanup policy
- Storage ops smoke
- Production env checklist

### Sprint 5: Notification delivery operations

Goal: Harden general notification delivery beyond login approval push.

Deliverables:

- Worker/queue decision
- Delivery processor runbook
- Retry/dead-letter policy
- Preference/quiet-hour enforcement
- Provider failure logging
- Admin delivery log drilldown
- Child reminder/lifecycle/saved-search delivery smoke
- Provider disabled/sandbox/live gates

### Sprint 6: RAG/assistant productization

Goal: Make assistant a safe, grounded product differentiator.

Deliverables:

- RAG source cards
- Fallback behavior
- Eval report
- Usage/cost/rate limits
- Child context personalization smoke
- Medical/diagnosis/therapy/medicine boundary validation
- Web/mobile assistant UX pass
- Production Qdrant/Redis runbook

### Sprint 7: DevOps staging/prod

Goal: Establish production deployment capability.

Deliverables:

- Hosting decision
- Managed PostgreSQL
- Redis
- Qdrant
- S3/R2
- API/web/backoffice deployment
- Mobile build profile
- Secrets management
- Migration dry-run
- Backup/restore test
- Structured logging
- Error tracking
- Health checks
- Rollback runbook

### Sprint 8: Legal, policy, and marketplace safety

Goal: Make public marketplace surfaces launch-safe.

Deliverables:

- Terms
- Privacy/KVKK
- Cookie policy
- Prohibited items
- Child product safety disclaimer
- Payment/demo disclaimer
- Dispute/support guidance
- Contact/support page
- Public footer/header links

### Sprint 9: Final UI/UX release polish

Goal: Polish only after blockers are closed.

Deliverables:

- Web home/browse/detail/sell/messages/account/child/assistant/cart polish
- Mobile explore/detail/sell/edit/messages/child/assistant/basket polish
- Backoffice operational UX polish
- Empty/loading/error state pass
- Accessibility pass
- Copy reduction

### Sprint 10: Full validation and freeze

Goal: Freeze production candidate.

Deliverables:

- API tests
- Web unit/e2e
- Backoffice unit/e2e
- Mobile Jest/P0
- Security scripts
- Storage smoke
- Payment smoke
- Notification delivery smoke
- RAG eval
- Manual smoke evidence
- Known issues
- Go/no-go decision

## Validation command bundle

- pnpm preflight
- pnpm typecheck
- pnpm test:api:security
- pnpm test:mobile:p0
- pnpm release:mobile:p0
- pnpm test:e2e:web:release
- pnpm test:e2e:backoffice:release
- pnpm beta:critical-smoke
- pnpm release:artifacts
- pnpm deploy:check:staging

## Working rule

No new major feature should be started unless it directly closes a production blocker.

Production blockers outrank UI polish.

UI polish starts only after payment, storage, deploy, notification ops, assistant safety, legal pages, and mobile evidence are sufficiently closed.
