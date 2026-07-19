ALTER TABLE "notification_delivery_logs"
  DROP CONSTRAINT IF EXISTS "notification_delivery_logs_kind_check";
--> statement-breakpoint
ALTER TABLE "notification_delivery_logs"
  ADD CONSTRAINT "notification_delivery_logs_kind_check"
  CHECK ("kind" in ('child_lifecycle', 'saved_search', 'child_reminder', 'security', 'message_received', 'listing_favorited'));
--> statement-breakpoint
ALTER TABLE "notification_delivery_logs"
  DROP CONSTRAINT IF EXISTS "notification_delivery_logs_source_type_check";
--> statement-breakpoint
ALTER TABLE "notification_delivery_logs"
  ADD CONSTRAINT "notification_delivery_logs_source_type_check"
  CHECK ("source_type" in ('child_profile', 'saved_search', 'login_approval', 'conversation', 'listing'));
