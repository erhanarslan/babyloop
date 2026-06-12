CREATE TYPE "public"."profile_trust_risk_level" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TABLE "profile_trust_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"trust_score" integer DEFAULT 100 NOT NULL,
	"risk_score" integer DEFAULT 0 NOT NULL,
	"risk_level" "profile_trust_risk_level" DEFAULT 'low' NOT NULL,
	"safety_status" "profile_safety_status" DEFAULT 'active' NOT NULL,
	"open_case_count" integer DEFAULT 0 NOT NULL,
	"total_case_count" integer DEFAULT 0 NOT NULL,
	"recent_report_count" integer DEFAULT 0 NOT NULL,
	"recent_enforcement_count" integer DEFAULT 0 NOT NULL,
	"sensitive_access_count" integer DEFAULT 0 NOT NULL,
	"ai_summary_count" integer DEFAULT 0 NOT NULL,
	"last_report_at" timestamp with time zone,
	"last_enforcement_at" timestamp with time zone,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_trust_snapshots_trust_score_check" CHECK ("profile_trust_snapshots"."trust_score" between 0 and 100),
	CONSTRAINT "profile_trust_snapshots_risk_score_check" CHECK ("profile_trust_snapshots"."risk_score" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "profile_trust_snapshots" ADD CONSTRAINT "profile_trust_snapshots_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "profile_trust_snapshots_profile_id_unique" ON "profile_trust_snapshots" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "profile_trust_snapshots_risk_level_idx" ON "profile_trust_snapshots" USING btree ("risk_level");--> statement-breakpoint
CREATE INDEX "profile_trust_snapshots_computed_at_idx" ON "profile_trust_snapshots" USING btree ("computed_at");
