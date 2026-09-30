-- Additive upgrade for an existing DairyFlow installation. Back up before applying.
BEGIN;
ALTER TABLE "milk_entries" ADD COLUMN IF NOT EXISTS "destination" text DEFAULT 'bulk' NOT NULL;
ALTER TABLE "cattle" ADD COLUMN IF NOT EXISTS "species" text DEFAULT 'cattle' NOT NULL;
ALTER TABLE "cattle" ADD COLUMN IF NOT EXISTS "life_stage" text;
ALTER TABLE "cattle" ADD COLUMN IF NOT EXISTS "production_status" text;
ALTER TABLE "cattle" ADD COLUMN IF NOT EXISTS "reproductive_status" text;
ALTER TABLE "cattle" ADD COLUMN IF NOT EXISTS "health_status" text DEFAULT 'healthy' NOT NULL;
ALTER TABLE "cattle" ADD COLUMN IF NOT EXISTS "pen" text;
ALTER TABLE "cattle" ADD COLUMN IF NOT EXISTS "weight_kg" numeric(8, 2);
ALTER TABLE "cattle" ADD COLUMN IF NOT EXISTS "expected_calving_date" date;
ALTER TABLE "cattle" ADD COLUMN IF NOT EXISTS "breeding_cycle_id" varchar;
ALTER TABLE "cattle" ADD COLUMN IF NOT EXISTS "milk_withhold_until" timestamp;
ALTER TABLE "cattle" ADD COLUMN IF NOT EXISTS "meat_withhold_until" timestamp;
ALTER TABLE "cattle" ADD COLUMN IF NOT EXISTS "merged_into_id" varchar;
ALTER TABLE "cattle" ADD COLUMN IF NOT EXISTS "revision" integer DEFAULT 1 NOT NULL;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "batch_id" varchar;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "source_key" text;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "trigger" text;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "cycle_id" varchar;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "protocol_id" varchar;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "protocol_version" integer;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "supplies" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "clinical" jsonb;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "evidence_required" boolean DEFAULT false NOT NULL;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "evidence" jsonb;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "reason" text;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "original_due_date" date;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "revision" integer DEFAULT 1 NOT NULL;

CREATE TABLE IF NOT EXISTS "animal_groups" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'manual' NOT NULL,
	"cattle_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"criteria" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);


CREATE TABLE IF NOT EXISTS "care_protocols" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"family_id" varchar NOT NULL,
	"name" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"trigger" text NOT NULL,
	"eligibility" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"approved_by" varchar,
	"approval_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"approved_at" timestamp
);


CREATE TABLE IF NOT EXISTS "daily_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"date" date NOT NULL,
	"revision" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"generated_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);


CREATE TABLE IF NOT EXISTS "diet_plans" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" text NOT NULL,
	"cattle_id" varchar,
	"group_id" varchar,
	"start_date" date NOT NULL,
	"end_date" date,
	"trigger" text,
	"ingredients" jsonb NOT NULL,
	"instructions" text,
	"approved_by" varchar,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);


CREATE TABLE IF NOT EXISTS "farm_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"cattle_id" varchar,
	"batch_id" varchar,
	"type" text NOT NULL,
	"date" date NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_type" text,
	"source_id" varchar,
	"recorded_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);


CREATE TABLE IF NOT EXISTS "operation_receipts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"key" text NOT NULL,
	"request_hash" text NOT NULL,
	"response" jsonb,
	"status_code" integer DEFAULT 200 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);


CREATE TABLE IF NOT EXISTS "report_schedules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"cutoff" text DEFAULT '23:00' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_date" date,
	"created_at" timestamp DEFAULT now() NOT NULL
);


CREATE TABLE IF NOT EXISTS "stock_ledger" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"lot_id" varchar NOT NULL,
	"item_id" varchar NOT NULL,
	"type" text NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"cost" numeric(14, 4) DEFAULT '0' NOT NULL,
	"cattle_id" varchar,
	"task_id" varchar,
	"date" date NOT NULL,
	"reason" text,
	"recorded_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);


CREATE TABLE IF NOT EXISTS "stock_lots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"item_id" varchar NOT NULL,
	"batch_number" text NOT NULL,
	"expiry_date" date,
	"received_date" date NOT NULL,
	"opened_date" date,
	"usable_days" integer,
	"quantity" numeric(14, 3) DEFAULT '0' NOT NULL,
	"unit_cost" numeric(14, 4) DEFAULT '0' NOT NULL,
	"supplier" text,
	"invoice" text,
	"location" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);


CREATE TABLE IF NOT EXISTS "work_batches" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"title" text NOT NULL,
	"group_id" varchar,
	"date" date NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);


CREATE UNIQUE INDEX IF NOT EXISTS "tasks_source_key_idx" ON "tasks" USING btree ("tenant_id","source_key");

CREATE UNIQUE INDEX IF NOT EXISTS "protocol_version_idx" ON "care_protocols" USING btree ("tenant_id","family_id","version");

CREATE UNIQUE INDEX IF NOT EXISTS "daily_report_revision_idx" ON "daily_reports" USING btree ("tenant_id","date","revision");

CREATE INDEX IF NOT EXISTS "farm_events_tenant_date_idx" ON "farm_events" USING btree ("tenant_id","date");

CREATE UNIQUE INDEX IF NOT EXISTS "operation_receipt_key_idx" ON "operation_receipts" USING btree ("tenant_id","key");

CREATE UNIQUE INDEX IF NOT EXISTS "report_schedule_tenant_idx" ON "report_schedules" USING btree ("tenant_id");

CREATE INDEX IF NOT EXISTS "stock_lots_item_idx" ON "stock_lots" USING btree ("tenant_id","item_id");
ALTER TABLE inventory_items ALTER COLUMN current_stock TYPE numeric(14,3);
UPDATE cattle SET life_stage=CASE WHEN stage IN ('calf','heifer') THEN stage ELSE 'adult' END WHERE life_stage IS NULL;
UPDATE cattle SET production_status=CASE stage WHEN 'milking' THEN 'lactating' WHEN 'dry' THEN 'dry' WHEN 'pregnant' THEN NULL ELSE 'not_lactating' END WHERE production_status IS NULL;
UPDATE cattle SET reproductive_status=CASE WHEN stage='pregnant' THEN 'pregnant' ELSE 'unserved' END WHERE reproductive_status IS NULL;
UPDATE cattle c SET expected_calving_date=p.expected_calving_date,breeding_cycle_id=COALESCE(p.insemination_id,p.id)
FROM pregnancy_tests p WHERE c.id=p.cattle_id AND c.tenant_id=p.tenant_id AND c.reproductive_status='pregnant' AND c.expected_calving_date IS NULL
AND p.result='positive' AND p.expected_calving_date IS NOT NULL
AND NOT EXISTS(SELECT 1 FROM pregnancy_tests newer WHERE newer.cattle_id=c.id AND newer.test_date>p.test_date)
AND NOT EXISTS(SELECT 1 FROM calvings b WHERE b.cattle_id=c.id AND b.date>=p.test_date);
COMMIT;
