ALTER TYPE "public"."listing_image_review_status" ADD VALUE IF NOT EXISTS 'pending';--> statement-breakpoint
ALTER TYPE "public"."listing_image_review_status" ADD VALUE IF NOT EXISTS 'needs_review';--> statement-breakpoint

ALTER TABLE "listing_images" ADD COLUMN IF NOT EXISTS "authenticity_provider" varchar(120);--> statement-breakpoint
ALTER TABLE "listing_images" ADD COLUMN IF NOT EXISTS "authenticity_model" varchar(160);--> statement-breakpoint
ALTER TABLE "listing_images" ADD COLUMN IF NOT EXISTS "authenticity_prompt_version" varchar(160);--> statement-breakpoint
ALTER TABLE "listing_images" ADD COLUMN IF NOT EXISTS "authenticity_decision" varchar(40);--> statement-breakpoint
ALTER TABLE "listing_images" ADD COLUMN IF NOT EXISTS "authenticity_confidence" numeric(5, 4);--> statement-breakpoint
ALTER TABLE "listing_images" ADD COLUMN IF NOT EXISTS "authenticity_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "listing_images" ADD COLUMN IF NOT EXISTS "authenticity_flags" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "listing_images" ADD COLUMN IF NOT EXISTS "authenticity_checked_at" timestamp with time zone;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "listing_images_authenticity_decision_idx" ON "listing_images" USING btree ("authenticity_decision");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "listing_images_authenticity_checked_at_idx" ON "listing_images" USING btree ("authenticity_checked_at");
