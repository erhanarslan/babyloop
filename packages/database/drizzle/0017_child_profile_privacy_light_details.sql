CREATE TYPE "public"."child_profile_gender" AS ENUM('female', 'male', 'prefer_not_to_say');--> statement-breakpoint
CREATE TYPE "public"."child_profile_notification_cadence" AS ENUM('off', 'monthly', 'yearly');--> statement-breakpoint
ALTER TABLE "child_profiles" ALTER COLUMN "label" SET DEFAULT 'Çocuğum';--> statement-breakpoint
ALTER TABLE "child_profiles" ADD COLUMN "age_months" integer;--> statement-breakpoint
ALTER TABLE "child_profiles" ADD COLUMN "birth_month" integer;--> statement-breakpoint
ALTER TABLE "child_profiles" ADD COLUMN "birth_year" integer;--> statement-breakpoint
ALTER TABLE "child_profiles" ADD COLUMN "gender" "child_profile_gender";--> statement-breakpoint
ALTER TABLE "child_profiles" ADD COLUMN "notification_cadence" "child_profile_notification_cadence" DEFAULT 'off' NOT NULL;--> statement-breakpoint
ALTER TABLE "child_profiles" ADD CONSTRAINT "child_profiles_age_months_check" CHECK ("child_profiles"."age_months" is null or "child_profiles"."age_months" between 0 and 96);--> statement-breakpoint
ALTER TABLE "child_profiles" ADD CONSTRAINT "child_profiles_birth_month_check" CHECK ("child_profiles"."birth_month" is null or "child_profiles"."birth_month" between 1 and 12);--> statement-breakpoint
ALTER TABLE "child_profiles" ADD CONSTRAINT "child_profiles_birth_year_check" CHECK ("child_profiles"."birth_year" is null or "child_profiles"."birth_year" between 2016 and 2035);
