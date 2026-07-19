CREATE INDEX IF NOT EXISTS "profiles_location_city_normalized_idx"
ON "profiles" (lower(trim("location_city")))
WHERE "location_city" IS NOT NULL;
