CREATE TABLE IF NOT EXISTS "notification_delivery_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "profile_id" uuid NOT NULL,
  "kind" varchar(80) NOT NULL,
  "source_type" varchar(80) NOT NULL,
  "source_id" varchar(160) NOT NULL,
  "channel" varchar(40) NOT NULL,
  "status" varchar(40) DEFAULT 'candidate' NOT NULL,
  "idempotency_key" varchar(240) NOT NULL,
  "dedup_key" varchar(240) NOT NULL,
  "frequency_window_hours" integer NOT NULL,
  "delivery_allowed" boolean DEFAULT false NOT NULL,
  "draft_only" boolean DEFAULT true NOT NULL,
  "blocked_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "sent_at" timestamp with time zone,
  "failed_at" timestamp with time zone,
  CONSTRAINT "notification_delivery_logs_status_check" CHECK ("status" in ('candidate', 'blocked', 'sent', 'failed', 'skipped')),
  CONSTRAINT "notification_delivery_logs_channel_check" CHECK ("channel" in ('in_app', 'email_draft', 'email', 'push', 'n8n')),
  CONSTRAINT "notification_delivery_logs_kind_check" CHECK ("kind" in ('child_lifecycle', 'saved_search'))
);
--> statement-breakpoint
ALTER TABLE "notification_delivery_logs" ADD CONSTRAINT "notification_delivery_logs_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "notification_delivery_logs_idempotency_key_unique" ON "notification_delivery_logs" USING btree ("idempotency_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_delivery_logs_profile_created_at_idx" ON "notification_delivery_logs" USING btree ("profile_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_delivery_logs_dedup_created_at_idx" ON "notification_delivery_logs" USING btree ("dedup_key","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_delivery_logs_kind_source_idx" ON "notification_delivery_logs" USING btree ("kind","source_type","source_id");
