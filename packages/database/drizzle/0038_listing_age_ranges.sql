ALTER TABLE "listings"
ADD COLUMN "recommended_age_min_months" integer;

ALTER TABLE "listings"
ADD COLUMN "recommended_age_max_months" integer;

ALTER TABLE "listings"
ADD CONSTRAINT "listings_recommended_age_range_check"
CHECK (
  (
    "recommended_age_min_months" IS NULL
    AND "recommended_age_max_months" IS NULL
  )
  OR (
    "recommended_age_min_months" IS NOT NULL
    AND "recommended_age_max_months" IS NOT NULL
    AND "recommended_age_min_months" BETWEEN 0 AND 216
    AND "recommended_age_max_months" BETWEEN 0 AND 216
    AND "recommended_age_min_months" <= "recommended_age_max_months"
  )
);

CREATE INDEX "listings_recommended_age_range_idx"
ON "listings" (
  "recommended_age_min_months",
  "recommended_age_max_months",
  "published_at"
);
