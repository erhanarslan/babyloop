# BabyLoop Discovery, Personalization, and Recommendation Roadmap

## Purpose

This document captures the product roadmap for marketplace discovery, search, filtering,
logging, recent views, and explainable recommendations.

BabyLoop should not remain a simple listing board. The product direction is:

- category-first discovery,
- detailed filtering and sorting,
- privacy-safe behavioral logging,
- recent-view and preference-aware recommendations,
- child-profile-aware lifecycle suggestions,
- and eventually AI-assisted listing and valuation flows.

This roadmap is intentionally separated from the Trust & Safety roadmap. Trust & Safety
protects the marketplace; discovery and personalization make it useful, sticky, and
commercially stronger.

## Current State

Implemented foundations include:

- listing creation and listing detail,
- public listing list/detail,
- categories foundation,
- favorites,
- messaging,
- image upload/review,
- backoffice review tools,
- profile enforcement,
- audit browser,
- AI moderation summary foundations.

Not yet implemented:

- production-grade pagination metadata,
- category landing pages,
- category-specific filters,
- advanced sort options,
- search suggestions,
- saved searches,
- recent listing views,
- recommendation feed,
- UI event logging,
- API/product analytics logging,
- child-profile-aware recommendations,
- AI-assisted listing draft from user images,
- internal comparable valuation.

## Category-first Discovery

Discovery should be built around the category model, not only free-text search.

Planned category behaviors:

- category landing pages,
- category tree/breadcrumbs,
- category-specific filters,
- category-specific sort presets,
- category-specific empty states,
- category-aware search suggestions,
- category-aware recommendation modules.

Examples:

- Strollers may expose brand, model, foldability, travel system compatibility, age range.
- Clothing may expose size, season, condition, material, gender-neutral option.
- Feeding items may expose age range, material, hygiene condition, bundle status.
- Toys may expose age range, developmental stage, material, safety warning.

## Pagination, Sort, and Detailed Filters

Listing endpoints should evolve from simple list/search to a proper discovery API.

Planned query capabilities:

- cursor or page pagination,
- safe max limit caps,
- stable sort,
- newest,
- price low-to-high,
- price high-to-low,
- relevance,
- distance/location if location precision is later supported,
- category filter,
- condition filter,
- listing type filter,
- price range,
- city/district filter,
- image-only filter,
- seller safety/trust filter for admin-only tools.

Public API responses should include pagination metadata:

- items,
- nextCursor or page info,
- total count only if cheap and safe,
- applied filters,
- applied sort.

## Search Suggestions

Search suggestions should be built in layers.

MVP suggestion sources:

- category names,
- popular safe search terms,
- brand/model terms extracted from approved listings,
- recent user searches if privacy-safe and user-scoped,
- child-profile age band needs if available.

Examples:

- "bebek arabası" -> "travel sistem bebek arabası", "bebek arabası güneşlik", "bebek arabası sineklik"
- "zıbın" -> "askılı zıbın", "yazlık zıbın", "0-3 ay zıbın"
- "mama sandalyesi" -> "katlanır mama sandalyesi", "tepsili mama sandalyesi"

Do not suggest unsafe, adult, medical, or sensitive terms.

## Privacy-safe Product Event Logging

Personalization requires event data, but the logging design must be privacy-safe.

Planned event types:

- listing_viewed,
- category_viewed,
- search_submitted,
- filter_changed,
- sort_changed,
- listing_favorited,
- listing_unfavorited,
- conversation_started,
- recommendation_impression,
- recommendation_clicked,
- listing_ai_suggestion_generated,
- listing_ai_suggestion_applied,
- listing_ai_suggestion_ignored.

Logging rules:

- do not log raw message bodies,
- do not log raw sensitive health-like text,
- do not log raw child names,
- do not log precise addresses,
- do not log tokens or cookies,
- store safe IDs and safe enums,
- keep event payloads allowlisted,
- separate public product analytics from admin/security audit events.

## Recent Listing Views

Recent views are a low-risk, high-value personalization feature.

MVP:

- store recent listing IDs per user/profile,
- cap history length,
- support removal/clear all,
- do not expose one user's history to another user,
- use recent views for simple recommendation modules.

Example modules:

- "Son baktıkların"
- "Bunlara benzer ilanlar"
- "Bu kategoriye göre işine yarayabilecekler"

## Explainable Recommendations

Recommendations should start rule-based and explainable before advanced ML.

Recommendation sources:

- recently viewed categories,
- favorited categories,
- child profile age band,
- season,
- similar listing category,
- complementary category mapping,
- price range similarity,
- location/city if safe.

Examples:

- If the user views strollers:
  - stroller accessories,
  - sunshade,
  - mosquito net,
  - travel cup holder,
  - baby carrier,
  - balance bike later if child age suggests it.

- If the user views onesies:
  - sleeveless summer onesies,
  - muslin blankets,
  - thin cotton sets,
  - seasonal clothing bundles.

- If the user views feeding items:
  - bibs,
  - feeding sets,
  - high chair accessories,
  - baby-safe storage containers.

Each recommendation should have a simple explanation:

- "Because you viewed strollers"
- "Useful for warm weather"
- "Often needed around this age"
- "Similar to your recent views"

## AI-assisted Listing Draft Dependency

The future image-based listing assistant depends on discovery foundations.

Before advanced listing AI:

- categories must be stable,
- category metadata should exist,
- category-specific listing attributes should be known,
- listing events should be logged,
- internal comparable listings should be queryable.

Future listing AI should support:

- image-based category suggestion,
- brand/model guess,
- condition hints,
- title suggestion,
- description suggestion,
- price range suggestion,
- internal comparable signals,
- seller confirmation before applying AI output.

AI output should be advisory, not authoritative.

## Recommended Implementation Sequence

1. Product event logging foundation.
2. Listing pagination, sort, and detailed filters.
3. Category landing metadata.
4. Search suggestions.
5. Recent listing views.
6. Explainable rule-based recommendations.
7. Child-profile-aware recommendations.
8. AI-assisted listing draft from images.
9. Internal comparable valuation.
10. Marketplace personalization dashboard.

## Deferred

- ML ranking,
- external marketplace scraping,
- paid recommendation slots,
- location-distance ranking,
- SMS remarketing,
- cross-device identity stitching,
- advanced personalization experiments.
