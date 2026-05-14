CREATE TYPE "public"."ai_model_run_status" AS ENUM('success', 'error', 'validation_failed', 'provider_failed', 'skipped');--> statement-breakpoint
CREATE TABLE "ai_model_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feature" varchar(120) NOT NULL,
	"provider_name" varchar(120) NOT NULL,
	"model_name" varchar(160),
	"prompt_version" varchar(160) NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"output" jsonb,
	"confidence_score" numeric(5, 4),
	"risk_score" numeric(5, 4),
	"status" "ai_model_run_status" NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ai_model_runs_feature_idx" ON "ai_model_runs" USING btree ("feature");--> statement-breakpoint
CREATE INDEX "ai_model_runs_status_idx" ON "ai_model_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_model_runs_created_at_idx" ON "ai_model_runs" USING btree ("created_at");
