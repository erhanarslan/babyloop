ALTER TABLE "notification_delivery_logs" ADD COLUMN IF NOT EXISTS "provider" varchar(40);
--> statement-breakpoint
ALTER TABLE "notification_delivery_logs" ADD COLUMN IF NOT EXISTS "provider_status" varchar(40);
--> statement-breakpoint
ALTER TABLE "notification_delivery_logs" ADD COLUMN IF NOT EXISTS "provider_message_id" varchar(160);
--> statement-breakpoint
ALTER TABLE "notification_delivery_logs" ADD COLUMN IF NOT EXISTS "attempt_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "notification_delivery_logs" ADD COLUMN IF NOT EXISTS "last_attempt_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "notification_delivery_logs" ADD COLUMN IF NOT EXISTS "next_attempt_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "notification_delivery_logs" ADD COLUMN IF NOT EXISTS "last_error_code" varchar(80);
--> statement-breakpoint
ALTER TABLE "notification_delivery_logs" ADD COLUMN IF NOT EXISTS "last_error_message_redacted" varchar(240);
--> statement-breakpoint
ALTER TABLE "notification_delivery_logs" ADD COLUMN IF NOT EXISTS "provider_response_meta" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "notification_delivery_logs" ADD COLUMN IF NOT EXISTS "skipped_reason" varchar(120);
--> statement-breakpoint
ALTER TABLE "notification_delivery_logs" ADD COLUMN IF NOT EXISTS "delivered_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_delivery_logs_provider_status_idx" ON "notification_delivery_logs" USING btree ("provider","status","next_attempt_at");
--> statement-breakpoint
ALTER TABLE "notification_push_tokens" ADD COLUMN IF NOT EXISTS "token_ciphertext" text;
--> statement-breakpoint
ALTER TABLE "notification_push_tokens" ADD COLUMN IF NOT EXISTS "token_nonce" varchar(32);
--> statement-breakpoint
ALTER TABLE "notification_push_tokens" ADD COLUMN IF NOT EXISTS "token_tag" varchar(32);
