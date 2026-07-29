ALTER TABLE "users" ADD COLUMN "is_demo_system_account" boolean DEFAULT false NOT NULL;
ALTER TABLE "users" ADD COLUMN "login_disabled" boolean DEFAULT false NOT NULL;
ALTER TABLE "users" ADD COLUMN "provider_delivery_disabled" boolean DEFAULT false NOT NULL;

ALTER TABLE "profiles" ADD COLUMN "is_demo_system_profile" boolean DEFAULT false NOT NULL;

ALTER TABLE "listings" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;
ALTER TABLE "listings" ADD COLUMN "demo_seed_key" varchar(160);
ALTER TABLE "listings" ADD COLUMN "demo_seed_version" varchar(80);

CREATE UNIQUE INDEX "listings_demo_seed_key_unique"
  ON "listings" USING btree ("demo_seed_key")
  WHERE "demo_seed_key" IS NOT NULL;

ALTER TABLE "listings" ADD CONSTRAINT "listings_demo_seed_metadata_check" CHECK (
  ("is_demo" = false AND "demo_seed_key" IS NULL AND "demo_seed_version" IS NULL)
  OR
  ("is_demo" = true AND "demo_seed_key" IS NOT NULL AND "demo_seed_version" IS NOT NULL)
);
