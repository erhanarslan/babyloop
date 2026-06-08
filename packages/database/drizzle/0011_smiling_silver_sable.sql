CREATE TYPE "public"."moderation_case_status" AS ENUM('pending', 'in_review', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."moderation_priority" AS ENUM('low', 'normal', 'high');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('pending', 'reviewed', 'dismissed', 'action_taken');--> statement-breakpoint
CREATE TYPE "public"."safety_target_type" AS ENUM('listing', 'profile', 'message');--> statement-breakpoint
CREATE TABLE "blocked_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blocker_profile_id" uuid NOT NULL,
	"blocked_profile_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blocked_profiles_not_self_check" CHECK ("blocked_profiles"."blocker_profile_id" <> "blocked_profiles"."blocked_profile_id")
);
--> statement-breakpoint
CREATE TABLE "moderation_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"moderation_case_id" uuid,
	"actor_profile_id" uuid,
	"action_type" varchar(80) NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moderation_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid,
	"target_type" "safety_target_type" NOT NULL,
	"target_id" uuid NOT NULL,
	"status" "moderation_case_status" DEFAULT 'pending' NOT NULL,
	"priority" "moderation_priority" DEFAULT 'normal' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_profile_id" uuid NOT NULL,
	"target_type" "safety_target_type" NOT NULL,
	"target_id" uuid NOT NULL,
	"reason" varchar(80) NOT NULL,
	"details" text,
	"status" "report_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_reason_check" CHECK ("reports"."reason" in ('safety', 'scam', 'inappropriate', 'prohibited_item', 'harassment', 'other'))
);
--> statement-breakpoint
CREATE TABLE "user_safety_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid,
	"event_type" varchar(120) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "blocked_profiles" ADD CONSTRAINT "blocked_profiles_blocker_profile_id_profiles_id_fk" FOREIGN KEY ("blocker_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocked_profiles" ADD CONSTRAINT "blocked_profiles_blocked_profile_id_profiles_id_fk" FOREIGN KEY ("blocked_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_moderation_case_id_moderation_cases_id_fk" FOREIGN KEY ("moderation_case_id") REFERENCES "public"."moderation_cases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_actor_profile_id_profiles_id_fk" FOREIGN KEY ("actor_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_cases" ADD CONSTRAINT "moderation_cases_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_profile_id_profiles_id_fk" FOREIGN KEY ("reporter_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_safety_events" ADD CONSTRAINT "user_safety_events_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "blocked_profiles_blocker_blocked_unique" ON "blocked_profiles" USING btree ("blocker_profile_id","blocked_profile_id");--> statement-breakpoint
CREATE INDEX "blocked_profiles_blocker_profile_id_idx" ON "blocked_profiles" USING btree ("blocker_profile_id");--> statement-breakpoint
CREATE INDEX "blocked_profiles_blocked_profile_id_idx" ON "blocked_profiles" USING btree ("blocked_profile_id");--> statement-breakpoint
CREATE INDEX "moderation_actions_case_id_idx" ON "moderation_actions" USING btree ("moderation_case_id");--> statement-breakpoint
CREATE INDEX "moderation_actions_actor_profile_id_idx" ON "moderation_actions" USING btree ("actor_profile_id");--> statement-breakpoint
CREATE INDEX "moderation_actions_action_type_idx" ON "moderation_actions" USING btree ("action_type");--> statement-breakpoint
CREATE INDEX "moderation_cases_report_id_idx" ON "moderation_cases" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "moderation_cases_target_idx" ON "moderation_cases" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "moderation_cases_status_priority_idx" ON "moderation_cases" USING btree ("status","priority");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_reporter_target_unique" ON "reports" USING btree ("reporter_profile_id","target_type","target_id");--> statement-breakpoint
CREATE INDEX "reports_target_idx" ON "reports" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "reports_status_created_at_idx" ON "reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "reports_reporter_profile_id_idx" ON "reports" USING btree ("reporter_profile_id");--> statement-breakpoint
CREATE INDEX "user_safety_events_profile_id_idx" ON "user_safety_events" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "user_safety_events_event_type_idx" ON "user_safety_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "user_safety_events_created_at_idx" ON "user_safety_events" USING btree ("created_at");