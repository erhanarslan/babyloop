CREATE TABLE IF NOT EXISTS "runtime_worker_heartbeats" (
  "worker_name" varchar(80) PRIMARY KEY NOT NULL,
  "worker_id" varchar(120) NOT NULL,
  "status" varchar(20) DEFAULT 'idle' NOT NULL,
  "last_started_at" timestamp with time zone,
  "last_completed_at" timestamp with time zone,
  "last_heartbeat_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_error_code" varchar(80),
  "last_error_message_redacted" varchar(240),
  "last_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "runtime_worker_heartbeats_status_check"
    CHECK ("status" IN ('running', 'idle', 'failed', 'stopping'))
);

CREATE INDEX IF NOT EXISTS "runtime_worker_heartbeats_status_heartbeat_idx"
  ON "runtime_worker_heartbeats" ("status", "last_heartbeat_at");
