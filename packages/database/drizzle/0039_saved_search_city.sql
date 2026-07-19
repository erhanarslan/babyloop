ALTER TABLE "saved_searches"
ADD COLUMN "city" varchar(120);

ALTER TABLE "saved_searches"
ADD CONSTRAINT "saved_searches_city_not_blank_check"
CHECK ("city" IS NULL OR length(trim("city")) > 0);
