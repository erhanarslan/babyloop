CREATE TABLE IF NOT EXISTS "account_deletion_storage_cleanup_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"profile_id" uuid,
	"listing_id" uuid,
	"url" text NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error_code" varchar(80),
	"last_error_message_redacted" varchar(240),
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_deletion_storage_cleanup_status_check" CHECK ("account_deletion_storage_cleanup_jobs"."status" in ('pending', 'processing', 'completed', 'failed')),
	CONSTRAINT "account_deletion_storage_cleanup_attempt_count_check" CHECK ("account_deletion_storage_cleanup_jobs"."attempt_count" >= 0)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "account_deletion_storage_cleanup_jobs" ADD CONSTRAINT "account_deletion_storage_cleanup_jobs_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "account_deletion_storage_cleanup_jobs" ADD CONSTRAINT "account_deletion_storage_cleanup_jobs_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "account_deletion_storage_cleanup_batch_url_unique" ON "account_deletion_storage_cleanup_jobs" USING btree ("batch_id","url");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_deletion_storage_cleanup_status_created_idx" ON "account_deletion_storage_cleanup_jobs" USING btree ("status","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_deletion_storage_cleanup_batch_id_idx" ON "account_deletion_storage_cleanup_jobs" USING btree ("batch_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_deletion_storage_cleanup_profile_id_idx" ON "account_deletion_storage_cleanup_jobs" USING btree ("profile_id");
