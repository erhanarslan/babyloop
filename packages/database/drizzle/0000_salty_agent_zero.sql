CREATE TYPE "public"."listing_condition" AS ENUM('new', 'like_new', 'good', 'fair', 'needs_repair');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."listing_type" AS ENUM('sale', 'swap', 'donation', 'rent');--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_profile_id" uuid,
	"event_type" varchar(120) NOT NULL,
	"entity_type" varchar(120) NOT NULL,
	"entity_id" uuid NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"url" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_profile_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"title" varchar(160) NOT NULL,
	"description" text,
	"price_amount" numeric(12, 2),
	"currency" varchar(3) DEFAULT 'TRY' NOT NULL,
	"status" "listing_status" DEFAULT 'draft' NOT NULL,
	"listing_type" "listing_type" DEFAULT 'sale' NOT NULL,
	"condition" "listing_condition" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"slug" varchar(140) NOT NULL,
	"parent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" varchar(120) NOT NULL,
	"avatar_url" text,
	"location_city" varchar(120),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_actor_profile_id_profiles_id_fk" FOREIGN KEY ("actor_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_images" ADD CONSTRAINT "listing_images_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_seller_profile_id_profiles_id_fk" FOREIGN KEY ("seller_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_category_id_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_parent_id_product_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."product_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_actor_profile_id_idx" ON "events" USING btree ("actor_profile_id");--> statement-breakpoint
CREATE INDEX "events_entity_idx" ON "events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "events_event_type_idx" ON "events" USING btree ("event_type");--> statement-breakpoint
CREATE UNIQUE INDEX "favorites_profile_listing_unique" ON "favorites" USING btree ("profile_id","listing_id");--> statement-breakpoint
CREATE INDEX "favorites_listing_id_idx" ON "favorites" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "listing_images_listing_id_idx" ON "listing_images" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "listings_seller_profile_id_idx" ON "listings" USING btree ("seller_profile_id");--> statement-breakpoint
CREATE INDEX "listings_category_id_idx" ON "listings" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "listings_status_idx" ON "listings" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "product_categories_slug_unique" ON "product_categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "product_categories_parent_id_idx" ON "product_categories" USING btree ("parent_id");