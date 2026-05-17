CREATE TABLE "conversation_listing_contexts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"added_by_profile_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_listing_id_listings_id_fk";
--> statement-breakpoint
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_buyer_profile_id_profiles_id_fk";
--> statement-breakpoint
DROP INDEX "conversations_listing_buyer_unique";--> statement-breakpoint
DROP INDEX "conversations_listing_id_idx";--> statement-breakpoint
DROP INDEX "conversations_buyer_profile_id_idx";--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "profile_low_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "profile_high_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "created_by_profile_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "status" varchar(40) DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "last_message_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "conversation_listing_contexts" ADD CONSTRAINT "conversation_listing_contexts_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_listing_contexts" ADD CONSTRAINT "conversation_listing_contexts_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_listing_contexts" ADD CONSTRAINT "conversation_listing_contexts_added_by_profile_id_profiles_id_fk" FOREIGN KEY ("added_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_listing_contexts_conversation_listing_unique" ON "conversation_listing_contexts" USING btree ("conversation_id","listing_id");--> statement-breakpoint
CREATE INDEX "conversation_listing_contexts_conversation_id_idx" ON "conversation_listing_contexts" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "conversation_listing_contexts_listing_id_idx" ON "conversation_listing_contexts" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "conversation_listing_contexts_added_by_profile_id_idx" ON "conversation_listing_contexts" USING btree ("added_by_profile_id");--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_profile_low_id_profiles_id_fk" FOREIGN KEY ("profile_low_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_profile_high_id_profiles_id_fk" FOREIGN KEY ("profile_high_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_created_by_profile_id_profiles_id_fk" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_profile_pair_unique" ON "conversations" USING btree ("profile_low_id","profile_high_id");--> statement-breakpoint
CREATE INDEX "conversations_profile_low_id_idx" ON "conversations" USING btree ("profile_low_id");--> statement-breakpoint
CREATE INDEX "conversations_profile_high_id_idx" ON "conversations" USING btree ("profile_high_id");--> statement-breakpoint
CREATE INDEX "conversations_created_by_profile_id_idx" ON "conversations" USING btree ("created_by_profile_id");--> statement-breakpoint
CREATE INDEX "conversations_last_message_at_idx" ON "conversations" USING btree ("last_message_at");--> statement-breakpoint
ALTER TABLE "conversations" DROP COLUMN "listing_id";--> statement-breakpoint
ALTER TABLE "conversations" DROP COLUMN "buyer_profile_id";--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_profiles_not_same_check" CHECK ("conversations"."profile_low_id" <> "conversations"."profile_high_id");