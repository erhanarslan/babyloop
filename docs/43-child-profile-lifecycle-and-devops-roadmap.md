# BabyLoop Child Profile, Lifecycle Personalization, and DevOps Roadmap

## Purpose

This document captures the roadmap for child profiles, age/season-based needs,
purchase/view history, lifecycle recommendations, notification cadence, and production
DevOps hardening.

Child profiles should become a core personalization entity for BabyLoop. The product
should not recommend only from user clicks; it should understand what a child may need
based on age band, development stage, season, and previous marketplace behavior.

## Child Profile Scope

A user may have one or more child profiles.

MVP fields should be privacy-preserving:

- child profile ID,
- display label or nickname,
- birth month/year or age band,
- optional clothing size,
- optional shoe size,
- optional interests/needs tags,
- notification cadence preference,
- createdAt/updatedAt.

Avoid requiring:

- full legal name,
- exact birth date,
- sensitive health data,
- medical history,
- school/nursery location,
- precise address.

Child profile data must not be public and must not be shown to sellers.

## Lifecycle Need Bands

BabyLoop can maintain a rule-based lifecycle needs catalog.

Example need bands:

- pregnancy preparation,
- newborn 0-3 months,
- infant 3-6 months,
- infant 6-12 months,
- toddler 12-24 months,
- toddler 24-36 months,
- preschool 3+ years.

Example needs:

- newborn clothes,
- muslin cloth,
- stroller accessories,
- feeding items,
- teething items,
- play mat,
- high chair,
- first shoes,
- balance bike,
- seasonal clothing,
- travel accessories.

## Season-aware Recommendations

Recommendations should combine child age band and current season.

Examples:

- If a user views onesies in warm weather:
  - sleeveless cotton onesies may be more comfortable.
- If a user views strollers in summer:
  - sunshade, mosquito net, stroller fan, or cup holder may be useful.
- If a user views stroller accessories in winter:
  - rain cover or footmuff may be relevant.
- If a child is approaching walking age:
  - first shoes or push toys may be useful.

These recommendations should be phrased as helpful suggestions, not pressure tactics.

## Purchase and Behavior History

Future personalization should use:

- listing views,
- favorites,
- searches,
- category views,
- conversations started,
- purchase-confirmed events if purchase tracking exists,
- AI listing assistant usage,
- recommendation clicks,
- ignored recommendations.

The system should avoid overfitting from a single event. For example, one stroller view
should not permanently classify the user as a stroller buyer.

## Notification Cadence

Notification channels should be phased.

MVP channels:

- email,
- in-app notification.

Next:

- push notification.

Deferred until traction:

- SMS.

Cadence options:

- off,
- monthly,
- every 3 months,
- every 6 months,
- key age milestone only.

Examples:

- "Your child may be entering a new size range soon."
- "Warm weather is coming; light cotton clothing may be useful."
- "Based on your recent stroller views, these accessories may help."

Notifications must be opt-in or preference-controlled. SMS should remain deferred due to
cost and compliance overhead.

## Privacy Boundaries

Do not expose:

- child name to sellers,
- child profile data in public listing APIs,
- child data in raw analytics payloads,
- child data in audit metadata,
- sensitive health details,
- precise geolocation.

Do use:

- safe age band,
- safe category IDs,
- safe recommendation reason codes,
- safe notification cadence settings.

## Suggested Data Model Direction

Potential future tables:

- child_profiles,
- child_profile_preferences,
- lifecycle_need_catalog,
- child_profile_recommendation_events,
- recommendation_feedback,
- notification_preferences,
- notification_deliveries.

Do not implement all at once. Start with child_profiles and a small lifecycle catalog.

## DevOps Roadmap

As BabyLoop approaches production, DevOps work must be planned explicitly.

Required production foundations:

- staging and production environments,
- environment variable management,
- secret management,
- CI validation gates,
- migration review process,
- migration rollback strategy,
- database backup and restore drills,
- structured API logging,
- request correlation IDs,
- error tracking,
- uptime monitoring,
- performance monitoring,
- AI provider usage and cost monitoring,
- notification delivery monitoring,
- security header validation,
- incident checklist,
- release checklist.

## Recommended Implementation Sequence

1. Privacy-safe product event logging.
2. Recent listing views.
3. Child profile MVP.
4. Lifecycle need catalog.
5. Explainable recommendations.
6. Email lifecycle notifications.
7. Push notifications.
8. AI-assisted listing draft from images.
9. Internal comparable valuation.
10. Production DevOps hardening.
11. SMS after traction.

## Deferred

- SMS before traction,
- advanced ML personalization,
- external data broker enrichment,
- child-sensitive profiling beyond safe age bands,
- healthcare personalization,
- paid medical/therapy recommendation automation.
