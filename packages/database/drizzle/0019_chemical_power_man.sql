DO $$ BEGIN
  CREATE TYPE "public"."child_profile_gender" AS ENUM('female', 'male', 'prefer_not_to_say');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."child_profile_notification_cadence" AS ENUM('off', 'monthly', 'yearly');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."child_profile_note_type" AS ENUM('general', 'feeding', 'sleep', 'size', 'preference', 'daycare', 'milestone');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."child_profile_reminder_channel" AS ENUM('in_app', 'email_draft');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."child_profile_reminder_status" AS ENUM('scheduled', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "child_profiles" ADD COLUMN IF NOT EXISTS "age_months" integer;
--> statement-breakpoint
ALTER TABLE "child_profiles" ADD COLUMN IF NOT EXISTS "birth_month" integer;
--> statement-breakpoint
ALTER TABLE "child_profiles" ADD COLUMN IF NOT EXISTS "birth_year" integer;
--> statement-breakpoint
ALTER TABLE "child_profiles" ADD COLUMN IF NOT EXISTS "gender" "child_profile_gender";
--> statement-breakpoint
ALTER TABLE "child_profiles" ADD COLUMN IF NOT EXISTS "notification_cadence" "child_profile_notification_cadence" DEFAULT 'off' NOT NULL;
--> statement-breakpoint
ALTER TABLE "child_profiles" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "child_profiles" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "child_profiles" ADD CONSTRAINT "child_profiles_age_months_check" CHECK ("child_profiles"."age_months" is null or "child_profiles"."age_months" between 0 and 96);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "child_profiles" ADD CONSTRAINT "child_profiles_birth_month_check" CHECK ("child_profiles"."birth_month" is null or "child_profiles"."birth_month" between 1 and 12);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "child_profiles" ADD CONSTRAINT "child_profiles_birth_year_check" CHECK ("child_profiles"."birth_year" is null or "child_profiles"."birth_year" between 2016 and 2035);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "child_profiles_age_band_idx" ON "child_profiles" USING btree ("age_band");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "child_profiles_profile_active_idx" ON "child_profiles" USING btree ("profile_id","is_active");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "child_profile_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "child_profile_id" uuid NOT NULL,
  "note_type" "child_profile_note_type" DEFAULT 'general' NOT NULL,
  "title" varchar(100) NOT NULL,
  "body" text,
  "is_archived" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "child_profile_notes_title_not_blank_check" CHECK (length(trim("child_profile_notes"."title")) > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "child_profile_reminders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "child_profile_id" uuid NOT NULL,
  "title" varchar(120) NOT NULL,
  "description" text,
  "remind_at" timestamp with time zone NOT NULL,
  "channel" "child_profile_reminder_channel" DEFAULT 'in_app' NOT NULL,
  "status" "child_profile_reminder_status" DEFAULT 'scheduled' NOT NULL,
  "completed_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "child_profile_reminders_title_not_blank_check" CHECK (length(trim("child_profile_reminders"."title")) > 0)
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "child_profile_notes" ADD CONSTRAINT "child_profile_notes_child_profile_id_child_profiles_id_fk" FOREIGN KEY ("child_profile_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "child_profile_reminders" ADD CONSTRAINT "child_profile_reminders_child_profile_id_child_profiles_id_fk" FOREIGN KEY ("child_profile_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "child_profile_notes_child_profile_id_idx" ON "child_profile_notes" USING btree ("child_profile_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "child_profile_notes_child_profile_archived_idx" ON "child_profile_notes" USING btree ("child_profile_id","is_archived");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "child_profile_reminders_child_profile_id_idx" ON "child_profile_reminders" USING btree ("child_profile_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "child_profile_reminders_child_profile_status_idx" ON "child_profile_reminders" USING btree ("child_profile_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "child_profile_reminders_remind_at_idx" ON "child_profile_reminders" USING btree ("remind_at");
