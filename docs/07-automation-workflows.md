# Automation Workflows

## Automation Boundaries

The workflows below describe target-state automation. Early implementation should start with explicit service calls or simple local jobs before adding Redis/BullMQ. Each automated step should be idempotent, log its status, and be safe to retry.

AI or automation failure should not delete user work. A draft listing can be saved even if AI suggestions fail; publishing can be held only when validation, policy, or moderation rules require it.

## Listing Creation Workflow

| Step | Action | Output |
| --- | --- | --- |
| 1 | Seller uploads images and draft details | Draft listing stored |
| 2 | Validate required fields and file rules | Validation result |
| 3 | Predict category and attributes | Suggested category/attributes |
| 4 | Generate title, description, and tags | Seller-editable suggestions |
| 5 | Run valuation | Price range, recommended price, fast-sale price, swap value |
| 6 | Generate embeddings | Listing vector for search/recommendations |
| 7 | Run moderation and fraud checks | Risk score and review state |
| 8 | Find similar listings | Comparable listing references |
| 9 | Index for search/recommendations | Discoverable listing |
| 10 | Log all AI tasks and events | Audit trail |

MVP listing creation should implement only the steps needed for the current phase. For example, embeddings and recommendation indexing can wait until search/RAG/recommendation phases need them.

## Valuation Workflow

1. Collect listing category, brand, model, age, condition, seller price, location, and media metadata.
2. Retrieve comparable active listings and previous transactions.
3. Apply category baseline and condition adjustments.
4. Produce structured valuation output.
5. Store valuation result and AI task log.
6. Ask seller for missing information if confidence is low.
7. Queue moderator review for high-value or safety-sensitive low-confidence listings.

## Embedding Workflow

| Source | Trigger | Storage |
| --- | --- | --- |
| Listing | Created or materially edited | Listing embedding in pgvector |
| Knowledge chunk | Knowledge document published | Chunk embedding in pgvector |
| Search query | Optional later phase | Query/session analytics |

Embeddings should include model version metadata so vectors can be regenerated safely after model changes.

## Moderation Workflow

1. User submits listing, media, profile text, or message.
2. System gathers content and behavior context.
3. AI moderation returns action, risk score, reason codes, and uncertainty.
4. Clear low-risk content is allowed.
5. Medium-risk content may trigger warning, rate limit, or review queue.
6. High-risk content can be blocked temporarily and sent to moderation.
7. Moderator reviews evidence and confirms or overrides.
8. Decision, reviewer, and override reason are logged.

Supported actions:

- allow
- warn
- block message
- rate-limit
- send to moderation queue
- temporary restriction
- ban recommendation

## Notification Workflow

| Trigger | Notification |
| --- | --- |
| Matching saved-search listing appears | Notify interested buyer |
| Favorited product price drops | Notify users who favorited it |
| Seller listing becomes stale | Suggest update or price reduction |
| AI asks for missing listing details | Notify seller |
| Offer/message received | Notify recipient |
| Moderation decision made | Notify affected user when appropriate |

Initial channels should be in-app and email. Push, WhatsApp, Telegram, and Instagram-related workflows should be added later.

## Admin Reporting Workflow

Daily jobs:

- new listings
- sold products
- message volume
- risky message rate
- report count
- high-value listing report

Weekly jobs:

- fastest selling categories
- most searched but under-supplied categories
- stale inventory summary
- suspicious user report
- valuation quality trends

Reports should be generated from analytics tables and include source metric names.

Admin reports should not directly expose private message bodies, raw child profile details, or unnecessary personal identifiers. Use aggregates and review links with permission checks.

## Stale Listing Workflow

1. Scheduled job finds active listings older than threshold with low engagement.
2. System checks category average sale time and price competitiveness.
3. AI or rules suggest better price, improved title, missing photos, or updated description.
4. Seller receives notification.
5. Seller action is tracked for analytics.

## Child-Age Recommendation Workflow

1. Parent profile stores child age range or expected birth date.
2. Scheduled job maps age stage to relevant categories.
3. System checks user budget, location, favorite brands, and previous purchases.
4. Recommendation engine ranks products and categories.
5. User receives in-app feed item or notification.

Example:

| Child stage | Suggested categories |
| --- | --- |
| 0-3 months | Crib, baby monitor, sterilizer, stroller bassinet, newborn clothes |
| 6 months | Feeding chair, crawling mat, baby safety gate, educational toys |
| 12 months | Walking shoes, child bicycle seat, Montessori toys, safety products |
