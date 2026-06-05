ALTER TYPE "public"."listing_status" ADD VALUE 'reserved' BEFORE 'archived';--> statement-breakpoint
ALTER TYPE "public"."listing_status" ADD VALUE 'sold' BEFORE 'archived';
