ALTER TYPE "public"."child_profile_note_type" ADD VALUE IF NOT EXISTS 'diaper';--> statement-breakpoint
ALTER TYPE "public"."child_profile_note_type" ADD VALUE IF NOT EXISTS 'activity';--> statement-breakpoint
ALTER TYPE "public"."child_profile_note_type" ADD VALUE IF NOT EXISTS 'shopping';--> statement-breakpoint
ALTER TYPE "public"."child_profile_note_type" ADD VALUE IF NOT EXISTS 'health_note';--> statement-breakpoint
ALTER TYPE "public"."child_profile_reminder_status" ADD VALUE IF NOT EXISTS 'paused';--> statement-breakpoint
ALTER TYPE "public"."notification_preference_source" ADD VALUE IF NOT EXISTS 'child_note';--> statement-breakpoint
ALTER TYPE "public"."notification_preference_source" ADD VALUE IF NOT EXISTS 'message';--> statement-breakpoint
ALTER TYPE "public"."notification_preference_source" ADD VALUE IF NOT EXISTS 'listing';--> statement-breakpoint
ALTER TYPE "public"."notification_preference_source" ADD VALUE IF NOT EXISTS 'security';--> statement-breakpoint
ALTER TYPE "public"."notification_preference_source" ADD VALUE IF NOT EXISTS 'marketing';--> statement-breakpoint
ALTER TYPE "public"."notification_preference_channel" ADD VALUE IF NOT EXISTS 'sms';--> statement-breakpoint

ALTER TABLE "child_profile_notes" ADD COLUMN IF NOT EXISTS "is_pinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "child_profile_notes_child_profile_pinned_idx" ON "child_profile_notes" USING btree ("child_profile_id","is_pinned");--> statement-breakpoint

ALTER TABLE "child_profile_reminders" ADD COLUMN IF NOT EXISTS "reminder_type" varchar(40) DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE "child_profile_reminders" ADD COLUMN IF NOT EXISTS "schedule_kind" varchar(40) DEFAULT 'one_time' NOT NULL;--> statement-breakpoint
ALTER TABLE "child_profile_reminders" ADD COLUMN IF NOT EXISTS "interval_minutes" integer;--> statement-breakpoint
ALTER TABLE "child_profile_reminders" ADD COLUMN IF NOT EXISTS "due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "child_profile_reminders" ADD COLUMN IF NOT EXISTS "event_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "child_profile_reminders" ADD COLUMN IF NOT EXISTS "notify_before_minutes" integer;--> statement-breakpoint
ALTER TABLE "child_profile_reminders" ADD COLUMN IF NOT EXISTS "local_time" varchar(5);--> statement-breakpoint
ALTER TABLE "child_profile_reminders" ADD COLUMN IF NOT EXISTS "timezone" varchar(80) DEFAULT 'Europe/Istanbul' NOT NULL;--> statement-breakpoint
ALTER TABLE "child_profile_reminders" ADD COLUMN IF NOT EXISTS "next_run_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "child_profile_reminders" ADD COLUMN IF NOT EXISTS "last_triggered_at" timestamp with time zone;--> statement-breakpoint
UPDATE "child_profile_reminders" SET "due_at" = COALESCE("due_at", "remind_at"), "next_run_at" = COALESCE("next_run_at", "remind_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "child_profile_reminders_next_run_at_idx" ON "child_profile_reminders" USING btree ("next_run_at");--> statement-breakpoint
ALTER TABLE "child_profile_reminders" ADD CONSTRAINT "child_profile_reminders_schedule_kind_check" CHECK ("schedule_kind" in ('one_time', 'interval', 'daily', 'weekly', 'relative_before_event'));--> statement-breakpoint
ALTER TABLE "child_profile_reminders" ADD CONSTRAINT "child_profile_reminders_reminder_type_check" CHECK ("reminder_type" in ('feeding', 'diaper', 'sleep', 'activity', 'shopping', 'appointment', 'general'));--> statement-breakpoint
ALTER TABLE "child_profile_reminders" ADD CONSTRAINT "child_profile_reminders_interval_minutes_check" CHECK ("interval_minutes" is null or "interval_minutes" between 15 and 43200);--> statement-breakpoint
ALTER TABLE "child_profile_reminders" ADD CONSTRAINT "child_profile_reminders_notify_before_minutes_check" CHECK ("notify_before_minutes" is null or "notify_before_minutes" between 1 and 43200);--> statement-breakpoint
ALTER TABLE "child_profile_reminders" ADD CONSTRAINT "child_profile_reminders_local_time_check" CHECK ("local_time" is null or "local_time" ~ '^[0-2][0-9]:[0-5][0-9]$');--> statement-breakpoint

ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "quiet_hours_start" varchar(5);--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "quiet_hours_end" varchar(5);--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "timezone" varchar(80) DEFAULT 'Europe/Istanbul' NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "digest" varchar(20) DEFAULT 'immediate' NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preference_audit_events" ADD COLUMN IF NOT EXISTS "old_digest" varchar(20);--> statement-breakpoint
ALTER TABLE "notification_preference_audit_events" ADD COLUMN IF NOT EXISTS "new_digest" varchar(20);--> statement-breakpoint
ALTER TABLE "notification_preference_audit_events" ADD COLUMN IF NOT EXISTS "old_quiet_hours_start" varchar(5);--> statement-breakpoint
ALTER TABLE "notification_preference_audit_events" ADD COLUMN IF NOT EXISTS "new_quiet_hours_start" varchar(5);--> statement-breakpoint
ALTER TABLE "notification_preference_audit_events" ADD COLUMN IF NOT EXISTS "old_quiet_hours_end" varchar(5);--> statement-breakpoint
ALTER TABLE "notification_preference_audit_events" ADD COLUMN IF NOT EXISTS "new_quiet_hours_end" varchar(5);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "notification_push_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "profile_id" uuid NOT NULL,
  "token_hash" varchar(128) NOT NULL,
  "platform" varchar(20) NOT NULL,
  "device_label" varchar(120),
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "notification_push_tokens_platform_check" CHECK ("platform" in ('ios', 'android', 'expo'))
);
--> statement-breakpoint
ALTER TABLE "notification_push_tokens" ADD CONSTRAINT "notification_push_tokens_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "notification_push_tokens_profile_hash_unique" ON "notification_push_tokens" USING btree ("profile_id","token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_push_tokens_profile_revoked_idx" ON "notification_push_tokens" USING btree ("profile_id","revoked_at");
