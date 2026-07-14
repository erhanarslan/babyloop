CREATE TABLE IF NOT EXISTS "short_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" varchar(12) NOT NULL,
  "target_type" varchar(40) NOT NULL,
  "target_id" uuid NOT NULL,
  "target_path" text NOT NULL,
  "created_by_profile_id" uuid,
  "source" varchar(80) DEFAULT 'listing_share' NOT NULL,
  "click_count" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "short_links_code_check" CHECK ("code" ~ '^[0-9A-Za-z]{6,12}$'),
  CONSTRAINT "short_links_target_type_check" CHECK (length(trim("target_type")) > 0),
  CONSTRAINT "short_links_target_path_check" CHECK (length(trim("target_path")) > 0 AND left("target_path", 1) = '/'),
  CONSTRAINT "short_links_click_count_check" CHECK ("click_count" >= 0)
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "short_links" ADD CONSTRAINT "short_links_created_by_profile_id_profiles_id_fk"
  FOREIGN KEY ("created_by_profile_id") REFERENCES "profiles"("id") ON DELETE set null;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "short_links_code_unique" ON "short_links" USING btree ("code");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "short_links_active_target_source_unique" ON "short_links" USING btree ("target_type","target_id","source") WHERE "is_active" = true AND "expires_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "short_links_target_idx" ON "short_links" USING btree ("target_type","target_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "short_links_created_by_profile_id_idx" ON "short_links" USING btree ("created_by_profile_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "short_links_active_code_idx" ON "short_links" USING btree ("code","is_active");
