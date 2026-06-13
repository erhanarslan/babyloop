CREATE TABLE "saved_searches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"query_text" varchar(120),
	"category_id" uuid,
	"listing_type" "listing_type",
	"condition" "listing_condition",
	"price_min" numeric(12, 2),
	"price_max" numeric(12, 2),
	"has_images" boolean DEFAULT false NOT NULL,
	"sort" varchar(32) DEFAULT 'newest' NOT NULL,
	"notifications_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_searches_name_not_blank_check" CHECK (length(trim("saved_searches"."name")) > 0),
	CONSTRAINT "saved_searches_query_text_not_blank_check" CHECK ("saved_searches"."query_text" is null or length(trim("saved_searches"."query_text")) > 0)
);
--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_category_id_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "saved_searches_profile_id_idx" ON "saved_searches" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "saved_searches_category_id_idx" ON "saved_searches" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "saved_searches_created_at_idx" ON "saved_searches" USING btree ("created_at");
