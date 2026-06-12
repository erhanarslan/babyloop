# BabyLoop Parent Support Assistant, Referrals, Payments, and Mobile Roadmap

## Purpose

This document defines the roadmap and boundaries for a future BabyLoop parent support
assistant.

The assistant should support parents, pregnant users, fathers-to-be, new mothers,
new fathers, and caregivers with everyday parenting guidance, product discovery,
checklists, and context-aware suggestions.

It must not become a healthcare, diagnosis, treatment, therapy, or diet platform.

## Product Positioning

BabyLoop Parent Support Assistant is:

- an everyday parenting support assistant,
- a marketplace discovery helper,
- a checklist and preparation assistant,
- a child lifecycle recommendation layer,
- a safe referral surface when the user expresses relevant need.

It is not:

- a doctor,
- a therapist,
- a dietitian,
- a diagnosis engine,
- a medication advisor,
- an emergency support service,
- a treatment planning product.

## Allowed Guidance

The assistant may provide common-sense, low-risk, everyday guidance.

Examples:

- "A gentle tummy massage may help some babies relax."
- "You can move the baby's legs slowly in a bicycle-like motion without forcing."
- "Some babies may be more gassy depending on feeding patterns."
- "For warm weather, light cotton sleeveless onesies may be more comfortable."
- "A hospital bag checklist may help you prepare."
- "For a stroller, a sunshade or mosquito net may be useful in summer."

The assistant should use cautious language:

- "may help",
- "can be useful",
- "some parents find",
- "if you are worried, speak with a professional",
- "do not force movement",
- "seek medical help if symptoms are severe or persistent."

## Disallowed Guidance

The assistant must not provide:

- diagnosis,
- treatment plans,
- medication advice,
- dosage advice,
- diet prescriptions,
- therapy claims,
- psychological diagnosis,
- emergency handling beyond advising professional help,
- guarantees about child development,
- claims that replace a doctor, psychologist, or dietitian.

Examples to avoid:

- "Your baby has X."
- "Use this medicine."
- "You need therapy."
- "Start this diet."
- "This will solve the problem."
- "Ignore the doctor."
- "Your child is delayed."

## Contextual Specialist Referral

Specialist referral should be contextual, optional, and human-toned.

Do not push referrals when the user did not express relevant need.

Correct approach:

- if user mentions stress, burnout, anxiety, loneliness, or feeling overwhelmed:
  - "This sounds tiring. If it keeps weighing on you, talking to someone may help. If you want, I can help you find support options."
- if user mentions nutrition, weight concern, feeding planning, or dietary confusion:
  - "If you want more personalized guidance, a dietitian could help. I can show available support options."
- if user is simply browsing onesies or strollers:
  - do not suggest a psychologist or dietitian.

Incorrect approach:

- "You need a psychologist."
- "You should see a dietitian."
- "I diagnosed your issue."
- "Book a session now."

## Referral and Promo Code Model

Future partner/referral flow:

- specialist directory,
- safe service cards,
- optional promo code,
- referral intent event,
- external booking link,
- partner attribution,
- later internal booking/payment if traction supports it.

Promo code behavior:

- optional,
- transparent,
- not disguised as medical advice,
- not pushed in crisis-like contexts,
- tracked with safe referral events.

MVP can start with referral tracking and external links. Internal booking can come later.

## Payment Roadmap

Payment should be phased.

Potential revenue streams:

- promoted listings,
- premium seller tools,
- specialist referral commission,
- parent support premium package,
- internal appointment booking,
- marketplace transaction/payment layer,
- future subscription features.

Recommended order:

1. Promo/referral tracking.
2. Promoted listing experiments.
3. Premium seller tools.
4. Specialist booking/payment only after partner validation.
5. Marketplace payment/escrow only after marketplace liquidity exists.

Avoid heavy payment/escrow complexity too early.

## Mobile Roadmap

Mobile is important, but should follow validated product flows.

Recommended sequence:

1. responsive web improvements,
2. PWA readiness,
3. notification architecture,
4. push notification support,
5. React Native planning,
6. mobile app MVP,
7. mobile-specific listing creation flow,
8. mobile camera/image AI listing assistant,
9. mobile parent support assistant.

Mobile must reuse the same API privacy boundaries and auth/session model.

## RAG Content Structure

Future RAG knowledge files should be curated and bounded.

Suggested content groups:

- pregnancy preparation checklists,
- father-to-be preparation,
- hospital bag checklist,
- newborn essentials,
- postpartum everyday support,
- baby gas comfort tips,
- seasonal clothing guidance,
- child age-band product needs,
- second-hand product safety checklist,
- when to consult a professional,
- marketplace buying/selling tips.

RAG content should include:

- source name,
- review date,
- allowed use,
- disallowed use,
- escalation/referral rule,
- disclaimer tone,
- product/category links where relevant.

Do not ingest random medical documents without review.

## Safety Tone

The assistant should feel helpful and human, not robotic or pushy.

Preferred tone:

- friendly,
- cautious,
- practical,
- non-diagnostic,
- non-alarming,
- product-aware when useful,
- referral-aware only when context supports it.

Example:

"Bu seni yoruyorsa bunu tek başına taşımak zorunda değilsin. İstersen bu konuda destek alabileceğin seçenekleri birlikte bulabiliriz."

## Relation to Child Profiles and Recommendations

The parent support assistant should connect to:

- child profile age band,
- season,
- recent product views,
- lifecycle need catalog,
- saved preferences,
- notification cadence,
- recommendation feedback.

Example:

- The user has a 6-9 month child profile.
- The user recently viewed feeding items.
- The assistant may suggest bibs, feeding sets, high chair accessories, and safe cleaning reminders.

## DevOps and Compliance Notes

Before production rollout:

- log assistant interactions safely,
- avoid raw sensitive data in analytics,
- monitor AI cost,
- monitor refusal/escalation patterns,
- track referral clicks safely,
- add incident handling for unsafe assistant output,
- maintain prompt/version history,
- document model/provider configuration,
- document emergency and professional-help boundaries.

## Recommended Implementation Sequence

1. RAG content structure and boundaries.
2. Parent support assistant mock/RAG MVP.
3. Safe assistant logging.
4. Contextual referral intent detection.
5. Specialist directory MVP.
6. Promo/referral tracking.
7. Email/push parent lifecycle notifications.
8. Payment experiments.
9. Mobile planning.
10. Mobile MVP.
11. SMS only after traction.

## Deferred

- medical advice,
- therapy automation,
- diet plans,
- emergency support handling beyond safe escalation,
- internal appointment payment before partner validation,
- SMS before traction,
- mobile app before web flows are stable.
