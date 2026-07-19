ALTER TABLE "child_profiles"
ADD COLUMN IF NOT EXISTS "age_as_of_date" timestamp with time zone;

UPDATE "child_profiles"
SET "age_as_of_date" = CURRENT_DATE
WHERE "age_months" IS NOT NULL
  AND "birth_month" IS NULL
  AND "birth_year" IS NULL
  AND "age_as_of_date" IS NULL;

ALTER TABLE "child_profiles"
DROP CONSTRAINT IF EXISTS "child_profiles_age_months_check";

ALTER TABLE "child_profiles"
ADD CONSTRAINT "child_profiles_age_months_check"
CHECK ("age_months" IS NULL OR "age_months" BETWEEN 0 AND 216);
