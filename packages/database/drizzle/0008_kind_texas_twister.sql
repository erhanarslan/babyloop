ALTER TABLE "listings" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TYPE "public"."listing_status" RENAME TO "listing_status_legacy";--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('draft', 'active', 'reserved', 'sold', 'archived');--> statement-breakpoint
ALTER TABLE "listings" ALTER COLUMN "status" TYPE "public"."listing_status" USING ("status"::text::"public"."listing_status");--> statement-breakpoint
ALTER TABLE "listings" ALTER COLUMN "status" SET DEFAULT 'draft';--> statement-breakpoint
DROP TYPE "public"."listing_status_legacy";
