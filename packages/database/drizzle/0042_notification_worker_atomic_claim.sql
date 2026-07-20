ALTER TABLE "notification_delivery_logs" ADD COLUMN IF NOT EXISTS "claim_token" varchar(64);
--> statement-breakpoint
ALTER TABLE "notification_delivery_logs" ADD COLUMN IF NOT EXISTS "claimed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "notification_delivery_logs" ADD COLUMN IF NOT EXISTS "claim_expires_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "notification_delivery_logs" ADD COLUMN IF NOT EXISTS "worker_id" varchar(120);
--> statement-breakpoint
ALTER TABLE "notification_delivery_logs" DROP CONSTRAINT IF EXISTS "notification_delivery_logs_status_check";
--> statement-breakpoint
ALTER TABLE "notification_delivery_logs" ADD CONSTRAINT "notification_delivery_logs_status_check" CHECK ("status" in ('candidate', 'processing', 'blocked', 'sent', 'failed', 'skipped'));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_delivery_logs_claim_idx" ON "notification_delivery_logs" USING btree ("status", "claim_expires_at", "next_attempt_at");
