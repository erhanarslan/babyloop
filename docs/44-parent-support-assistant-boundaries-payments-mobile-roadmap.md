# BabyLoop Assistant, Payment Simulation, and Mobile Roadmap

## Assistant / RAG direction

RAG/assistant is a product marketing differentiator and must be completed thoroughly.

The assistant may provide:

- everyday parenting checklists,
- safe marketplace buying/selling guidance,
- child age/season-based product suggestions,
- product discovery help,
- listing/saved-search-aware recommendations,
- cautious non-diagnostic parent support language.

The assistant must not provide:

- medical diagnosis,
- treatment plans,
- medication advice,
- dosage advice,
- diet prescriptions,
- therapy claims,
- emergency handling beyond advising professional help.

Required production scope:

- curated RAG ingestion,
- source-grounded answers,
- hallucination guard,
- prompt injection tests,
- sensitive data redaction,
- medical/therapy/drug/diet boundary tests,
- RAG eval set,
- backoffice RAG monitoring,
- model provider abstraction,
- cost/rate guardrails,
- web assistant UX,
- mobile assistant UX,
- behavior/child-profile signals for recommendations.

## Payment direction

There is no company/legal setup yet, so real payment collection is intentionally disabled.

However, the product should simulate a realistic paid flow:

- cart and checkout,
- mock payment success/failure,
- order state machine,
- payment state machine,
- commission calculator,
- platform fee,
- seller net amount,
- buyer total amount,
- service fee display,
- Iyzico-ready provider abstraction,
- webhook skeleton,
- refund/cancel state simulation,
- backoffice order/payment view,
- payment disabled/demo mode guard.

Goal: when legal/company setup is ready, only real Iyzico API keys and production enablement should remain.

## Mobile direction

Mobile app completion is required, not optional.

Remaining mobile scope includes:

- auth edge-case QA,
- MFA/OTP QA,
- security settings QA,
- browse/filter parity,
- listing detail parity,
- sell listing completion,
- image upload real-device QA,
- messages realtime hardening,
- image-only message attachments,
- offline/reconnect behavior,
- notifications,
- child notebook/reminders,
- assistant,
- checkout simulation,
- legal links,
- Android keyboard/composer fix,
- safe area/tab polish,
- app icon/splash,
- expanded Maestro E2E coverage.

Final mobile build/release pipeline can be handled in the final DevOps package.
