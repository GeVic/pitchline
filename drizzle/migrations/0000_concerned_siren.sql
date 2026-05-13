CREATE TYPE "public"."run_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."stage_name" AS ENUM('extract', 'match', 'personas', 'creative', 'config');--> statement-breakpoint
CREATE TYPE "public"."stage_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"pitch" text NOT NULL,
	"status" "run_status" DEFAULT 'pending' NOT NULL,
	"final_config" jsonb,
	"confidence" real,
	"error_message" text,
	"total_cost_usd" real,
	"total_duration_ms" integer
);
--> statement-breakpoint
CREATE TABLE "stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"order_idx" integer NOT NULL,
	"stage_name" "stage_name" NOT NULL,
	"status" "stage_status" DEFAULT 'pending' NOT NULL,
	"prompt" text,
	"raw_response" text,
	"parsed_output" jsonb,
	"model" text,
	"tokens_in" integer,
	"tokens_out" integer,
	"duration_ms" integer,
	"cost_usd" real,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "stages" ADD CONSTRAINT "stages_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;