CREATE TABLE IF NOT EXISTS "cart_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "buyer_profile_id" uuid NOT NULL,
  "listing_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "buyer_profile_id" uuid NOT NULL,
  "status" varchar(40) DEFAULT 'pending' NOT NULL,
  "currency" varchar(3) DEFAULT 'TRY' NOT NULL,
  "total_amount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
  "payment_provider" varchar(80) DEFAULT 'mock_iyzico' NOT NULL,
  "provider_payment_id" varchar(120),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "order_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL,
  "listing_id" uuid NOT NULL,
  "seller_profile_id" uuid NOT NULL,
  "title_snapshot" varchar(160) NOT NULL,
  "price_amount_snapshot" numeric(12, 2) DEFAULT '0.00' NOT NULL,
  "currency_snapshot" varchar(3) DEFAULT 'TRY' NOT NULL,
  "listing_type_snapshot" varchar(40) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_buyer_profile_id_profiles_id_fk" FOREIGN KEY ("buyer_profile_id") REFERENCES "profiles"("id") ON DELETE cascade;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE cascade;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "orders" ADD CONSTRAINT "orders_buyer_profile_id_profiles_id_fk" FOREIGN KEY ("buyer_profile_id") REFERENCES "profiles"("id") ON DELETE restrict;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE cascade;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "order_items" ADD CONSTRAINT "order_items_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE restrict;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "order_items" ADD CONSTRAINT "order_items_seller_profile_id_profiles_id_fk" FOREIGN KEY ("seller_profile_id") REFERENCES "profiles"("id") ON DELETE restrict;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "cart_items_buyer_listing_unique" ON "cart_items" USING btree ("buyer_profile_id", "listing_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cart_items_buyer_profile_id_idx" ON "cart_items" USING btree ("buyer_profile_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cart_items_listing_id_idx" ON "cart_items" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_buyer_profile_id_idx" ON "orders" USING btree ("buyer_profile_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_provider_payment_id_idx" ON "orders" USING btree ("provider_payment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_items_order_id_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_items_listing_id_idx" ON "order_items" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_items_seller_profile_id_idx" ON "order_items" USING btree ("seller_profile_id");
