# Assistant safety and hallucination guard

BabyLoop assistant/RAG work must stay inside a narrow parent-support boundary. The assistant can provide everyday parenting checklists, age-band shopping reminders, simple comfort/routine suggestions, non-medical safety reminders, and human referral suggestions when relevant.

It must not provide:

- medical diagnosis
- medication or dosage advice
- treatment plans
- diet prescriptions
- therapy claims
- unsupported product safety claims
- specific factual/statistical claims without grounding

Guard command:

```bash
pnpm security:assistant-safety-guard
```

Focused API test:

```bash
pnpm --filter @babyloop/api test test/assistant-safety-guard.service.test.ts
```

## Hallucination boundary

Specific claims require grounding and source IDs. The guard uses `requiresGroundingForSpecificClaims=true`, `requiresSourceIdsForRag=true`, and `maxUnsupportedSpecificClaims=0`.

RAG runtime is not enabled by this package. This package is a safety/readiness layer only.

## Medical and therapy boundary

The assistant must refuse diagnosis, medication/dosage, treatment plan, diet prescription, and therapy-plan requests. It can redirect to safe alternatives:

- general observation checklist
- questions to ask a doctor or relevant human professional
- daily routine/comfort suggestions that do not imply treatment
- emergency redirect when symptoms are serious or quickly worsening

## Privacy boundary

The assistant safety guard must not store or expose raw child data, raw message body, email, phone, token, cookie, OTP, password, or authorization values.

Exact guard wording: assistant safety guard requires grounding for specific claims.
