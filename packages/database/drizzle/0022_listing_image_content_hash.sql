ALTER TABLE "listing_images" ADD COLUMN IF NOT EXISTS "content_hash" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "listing_images_content_hash_idx" ON "listing_images" USING btree ("content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "listing_images_listing_content_hash_unique" ON "listing_images" USING btree ("listing_id","content_hash");
