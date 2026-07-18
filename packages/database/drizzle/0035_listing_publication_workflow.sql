CREATE TYPE "public"."listing_publication_state" AS ENUM(
  'awaiting_images',
  'ai_review',
  'admin_review',
  'scheduled',
  'published',
  'changes_requested'
);
--> statement-breakpoint

ALTER TABLE "listings"
  ADD COLUMN "publication_state" "listing_publication_state" DEFAULT 'awaiting_images' NOT NULL,
  ADD COLUMN "publish_after" timestamp with time zone,
  ADD COLUMN "published_at" timestamp with time zone,
  ADD COLUMN "publication_review_reason" text;
--> statement-breakpoint

CREATE TABLE "marketplace_publication_settings" (
  "id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
  "admin_review_enabled" boolean DEFAULT false NOT NULL,
  "auto_publish_delay_seconds" integer DEFAULT 30 NOT NULL,
  "updated_by_profile_id" uuid,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "marketplace_publication_settings_singleton_check" CHECK ("marketplace_publication_settings"."id" = 1),
  CONSTRAINT "marketplace_publication_settings_delay_check" CHECK ("marketplace_publication_settings"."auto_publish_delay_seconds" between 5 and 86400)
);
--> statement-breakpoint

ALTER TABLE "marketplace_publication_settings"
  ADD CONSTRAINT "marketplace_publication_settings_updated_by_profile_id_profiles_id_fk"
  FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

INSERT INTO "marketplace_publication_settings" (
  "id",
  "admin_review_enabled",
  "auto_publish_delay_seconds"
) VALUES (1, false, 30)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint

UPDATE "listings"
SET
  "publication_state" = CASE
    WHEN "status" IN ('active', 'reserved', 'sold') THEN 'published'::"listing_publication_state"
    WHEN "status" = 'archived' AND EXISTS (
      SELECT 1
      FROM "listing_images"
      WHERE "listing_images"."listing_id" = "listings"."id"
        AND "listing_images"."review_status" = 'approved'
    ) THEN 'published'::"listing_publication_state"
    WHEN "status" = 'archived' THEN 'awaiting_images'::"listing_publication_state"
    WHEN EXISTS (
      SELECT 1
      FROM "listing_images"
      WHERE "listing_images"."listing_id" = "listings"."id"
        AND "listing_images"."review_status" IN ('pending', 'needs_review')
    ) THEN 'ai_review'::"listing_publication_state"
    WHEN EXISTS (
      SELECT 1
      FROM "listing_images"
      WHERE "listing_images"."listing_id" = "listings"."id"
        AND "listing_images"."review_status" = 'approved'
    ) THEN 'scheduled'::"listing_publication_state"
    ELSE 'awaiting_images'::"listing_publication_state"
  END,
  "publish_after" = CASE
    WHEN "status" = 'draft'
      AND EXISTS (
        SELECT 1
        FROM "listing_images"
        WHERE "listing_images"."listing_id" = "listings"."id"
          AND "listing_images"."review_status" = 'approved'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM "listing_images"
        WHERE "listing_images"."listing_id" = "listings"."id"
          AND "listing_images"."review_status" IN ('pending', 'needs_review')
      ) THEN now() + interval '30 seconds'
    ELSE NULL
  END,
  "published_at" = CASE
    WHEN "status" IN ('active', 'reserved', 'sold') THEN COALESCE("updated_at", "created_at", now())
    WHEN "status" = 'archived' AND EXISTS (
      SELECT 1
      FROM "listing_images"
      WHERE "listing_images"."listing_id" = "listings"."id"
        AND "listing_images"."review_status" = 'approved'
    ) THEN COALESCE("updated_at", "created_at", now())
    ELSE NULL
  END,
  "publication_review_reason" = NULL;
--> statement-breakpoint

CREATE INDEX "listings_publication_state_idx" ON "listings" USING btree ("publication_state");
--> statement-breakpoint
CREATE INDEX "listings_publish_after_idx" ON "listings" USING btree ("publish_after");
--> statement-breakpoint
ALTER TABLE "listings"
  ADD CONSTRAINT "listings_public_lifecycle_publication_check"
  CHECK (
    "status" NOT IN ('active', 'reserved', 'sold')
    OR (
      "publication_state" = 'published'
      AND "published_at" IS NOT NULL
    )
  );
--> statement-breakpoint
ALTER TABLE "listings"
  ADD CONSTRAINT "listings_published_state_check"
  CHECK (
    "publication_state" <> 'published'
    OR (
      "status" IN ('active', 'reserved', 'sold', 'archived')
      AND "published_at" IS NOT NULL
    )
  );
--> statement-breakpoint
ALTER TABLE "listings"
  ADD CONSTRAINT "listings_scheduled_state_check"
  CHECK (
    "publication_state" <> 'scheduled'
    OR (
      "status" = 'draft'
      AND "publish_after" IS NOT NULL
    )
  );
--> statement-breakpoint
ALTER TABLE "listings"
  ADD CONSTRAINT "listings_publish_after_state_check"
  CHECK (
    "publish_after" IS NULL
    OR (
      "status" = 'draft'
      AND "publication_state" = 'scheduled'
    )
  );
