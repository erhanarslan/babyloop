UPDATE "listings"
SET
  "status" = 'draft',
  "updated_at" = now()
WHERE "status" IN ('active', 'reserved')
  AND NOT EXISTS (
    SELECT 1
    FROM "listing_images"
    WHERE "listing_images"."listing_id" = "listings"."id"
      AND "listing_images"."review_status" = 'approved'
  );
