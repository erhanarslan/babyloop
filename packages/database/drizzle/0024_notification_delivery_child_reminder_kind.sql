ALTER TABLE "notification_delivery_logs" DROP CONSTRAINT IF EXISTS "notification_delivery_logs_kind_check";
--> statement-breakpoint
ALTER TABLE "notification_delivery_logs" ADD CONSTRAINT "notification_delivery_logs_kind_check" CHECK ("kind" in ('child_lifecycle', 'saved_search', 'child_reminder'));
