ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mfa_otp_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"purpose" varchar(40) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mfa_otp_challenges" ADD CONSTRAINT "mfa_otp_challenges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mfa_otp_challenges_code_hash_idx" ON "mfa_otp_challenges" USING btree ("code_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mfa_otp_challenges_user_id_idx" ON "mfa_otp_challenges" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mfa_otp_challenges_expires_at_idx" ON "mfa_otp_challenges" USING btree ("expires_at");
