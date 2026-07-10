ALTER TABLE "notification_delivery_logs"
  DROP CONSTRAINT IF EXISTS "notification_delivery_logs_kind_check";

ALTER TABLE "notification_delivery_logs"
  ADD CONSTRAINT "notification_delivery_logs_kind_check"
  CHECK ("kind" in ('child_lifecycle', 'saved_search', 'child_reminder', 'security'));

ALTER TABLE "notification_delivery_logs"
  DROP CONSTRAINT IF EXISTS "notification_delivery_logs_source_type_check";

ALTER TABLE "notification_delivery_logs"
  ADD CONSTRAINT "notification_delivery_logs_source_type_check"
  CHECK ("source_type" in ('child_profile', 'saved_search', 'login_approval'));
