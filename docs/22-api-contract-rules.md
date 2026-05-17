# BabyLoop API Contract Rules

## Purpose

This document defines naming and contract rules for BabyLoop.

The goal is to stop the codebase from mixing database naming conventions with public API and frontend conventions.

---

## Core Decision

BabyLoop uses different naming conventions per layer.

| Layer | Convention |
|---|---|
| PostgreSQL table names | `snake_case` |
| PostgreSQL column names | `snake_case` |
| Drizzle TypeScript properties | `camelCase` |
| API request body keys | `camelCase` |
| API response body keys | `camelCase` |
| Frontend variables/types/props/state | `camelCase` |
| Error codes | `UPPER_SNAKE_CASE` |
| Environment variables | `UPPER_SNAKE_CASE` |
| Domain enum values | may remain `snake_case` |

---

## Database Naming

PostgreSQL table and column names must use `snake_case`.

Correct database names:

```sql
product_categories
listing_images
conversation_participants
conversation_listing_contexts
ai_model_runs