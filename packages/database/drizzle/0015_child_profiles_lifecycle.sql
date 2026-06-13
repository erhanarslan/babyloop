CREATE TYPE "public"."child_age_band" AS ENUM('expecting', 'newborn_0_3', 'infant_3_6', 'infant_6_12', 'toddler_12_24', 'preschool_24_36', 'child_3_plus');--> statement-breakpoint
CREATE TABLE "child_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"label" varchar(80) DEFAULT 'Child profile' NOT NULL,
	"age_band" "child_age_band" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "child_profiles_label_not_blank_check" CHECK (length(trim("child_profiles"."label")) > 0)
);
--> statement-breakpoint
ALTER TABLE "child_profiles" ADD CONSTRAINT "child_profiles_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "child_profiles_profile_id_idx" ON "child_profiles" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "child_profiles_age_band_idx" ON "child_profiles" USING btree ("age_band");--> statement-breakpoint
CREATE INDEX "child_profiles_profile_active_idx" ON "child_profiles" USING btree ("profile_id","is_active");
