CREATE TYPE "public"."profile_safety_status" AS ENUM('active', 'restricted', 'suspended');--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "safety_status" "profile_safety_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "safety_status_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "safety_status_reason_code" varchar(80);--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "safety_status_updated_by_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_safety_status_updated_by_profile_id_profiles_id_fk" FOREIGN KEY ("safety_status_updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "profiles_safety_status_idx" ON "profiles" USING btree ("safety_status");--> statement-breakpoint
CREATE INDEX "profiles_safety_status_updated_by_idx" ON "profiles" USING btree ("safety_status_updated_by_profile_id");