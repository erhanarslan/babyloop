CREATE TYPE "public"."listing_image_review_status" AS ENUM('approved', 'rejected');--> statement-breakpoint
ALTER TABLE "listing_images" ADD COLUMN "review_status" "listing_image_review_status" DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE "listing_images" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "listing_images" ADD COLUMN "reviewed_by_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "listing_images" ADD CONSTRAINT "listing_images_reviewed_by_profile_id_profiles_id_fk" FOREIGN KEY ("reviewed_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listing_images_review_status_idx" ON "listing_images" USING btree ("review_status");