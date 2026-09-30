CREATE TABLE "alerts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"type" text NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"title" text NOT NULL,
	"message" text,
	"cattle_id" varchar,
	"reference_type" text,
	"reference_id" varchar,
	"rule_id" varchar,
	"dedupe_key" text,
	"scheduled_for" timestamp,
	"is_read" boolean DEFAULT false NOT NULL,
	"is_dismissed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "attachment_links" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attachment_id" varchar NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"file_name" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"storage_key" text NOT NULL,
	"file_type" text NOT NULL,
	"uploaded_by" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"user_id" varchar,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" varchar,
	"old_data" jsonb,
	"new_data" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "breeds" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"type" text DEFAULT 'dairy' NOT NULL,
	"origin" text,
	"avg_milk_yield" numeric(6, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "breeds_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "byproduct_inventory" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"byproduct_type_id" varchar NOT NULL,
	"current_stock" numeric(12, 2) DEFAULT '0' NOT NULL,
	"avg_cost" numeric(10, 2),
	"last_updated" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "byproduct_transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"byproduct_type_id" varchar NOT NULL,
	"type" text NOT NULL,
	"date" date NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"price_per_unit" numeric(10, 2) NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"party_name" text,
	"party_phone" text,
	"payment_status" text DEFAULT 'paid' NOT NULL,
	"paid_amount" numeric(12, 2),
	"payment_method" text DEFAULT 'cash',
	"update_inventory" boolean DEFAULT false,
	"invoice_number" text,
	"notes" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "byproduct_types" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"unit" text DEFAULT 'kg' NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "byproduct_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "calvings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"cattle_id" varchar NOT NULL,
	"date" date NOT NULL,
	"calf_id" varchar,
	"calf_gender" text,
	"calf_weight" numeric(6, 2),
	"calving_ease" text DEFAULT 'normal',
	"outcome" text DEFAULT 'live' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cattle" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"tag_number" text NOT NULL,
	"name" text,
	"breed_id" varchar,
	"gender" text DEFAULT 'female' NOT NULL,
	"date_of_birth" date,
	"date_of_entry" date NOT NULL,
	"source" text DEFAULT 'born' NOT NULL,
	"purchase_price" numeric(12, 2),
	"mother_id" varchar,
	"father_id" varchar,
	"status" text DEFAULT 'active' NOT NULL,
	"stage" text DEFAULT 'heifer' NOT NULL,
	"species" text DEFAULT 'cattle' NOT NULL,
	"life_stage" text,
	"production_status" text,
	"reproductive_status" text,
	"health_status" text DEFAULT 'healthy' NOT NULL,
	"pen" text,
	"weight_kg" numeric(8, 2),
	"expected_calving_date" date,
	"breeding_cycle_id" varchar,
	"milk_withhold_until" timestamp,
	"meat_withhold_until" timestamp,
	"merged_into_id" varchar,
	"revision" integer DEFAULT 1 NOT NULL,
	"lactation_number" integer DEFAULT 0,
	"photo_url" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cattle_costs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"cattle_id" varchar NOT NULL,
	"date" date NOT NULL,
	"category" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"description" text,
	"allocation_method" text DEFAULT 'direct',
	"source_type" text,
	"source_id" varchar,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cattle_payments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"transaction_id" varchar NOT NULL,
	"date" date NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_method" text DEFAULT 'cash',
	"reference_number" text,
	"notes" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cattle_transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"cattle_id" varchar NOT NULL,
	"type" text NOT NULL,
	"date" date NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"party_name" text,
	"party_phone" text,
	"party_address" text,
	"payment_status" text DEFAULT 'pending' NOT NULL,
	"paid_amount" numeric(12, 2) DEFAULT '0',
	"payment_method" text DEFAULT 'cash',
	"purchase_cost_at_sale" numeric(12, 2),
	"total_costs_at_sale" numeric(12, 2),
	"milk_revenue_at_sale" numeric(12, 2),
	"profit_loss" numeric(12, 2),
	"invoice_number" text,
	"notes" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "expense_heads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"category" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "expense_heads_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"head_id" varchar NOT NULL,
	"date" date NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"description" text,
	"vendor_name" text,
	"invoice_number" text,
	"payment_method" text DEFAULT 'cash',
	"reference_type" text,
	"reference_id" varchar,
	"recorded_by" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "farm_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"farm_name" text,
	"logo_url" text,
	"address" text,
	"phone" text,
	"email" text,
	"currency" text DEFAULT 'INR' NOT NULL,
	"currency_symbol" text DEFAULT '₹' NOT NULL,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"date_format" text DEFAULT 'DD/MM/YYYY' NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"milk_unit" text DEFAULT 'liters' NOT NULL,
	"milking_sessions" integer DEFAULT 2 NOT NULL,
	"session1_name" text DEFAULT 'Morning' NOT NULL,
	"session2_name" text DEFAULT 'Evening' NOT NULL,
	"session3_name" text DEFAULT 'Night',
	"fat_mandatory" boolean DEFAULT false NOT NULL,
	"snf_mandatory" boolean DEFAULT false NOT NULL,
	"milk_drop_alert_percent" numeric(5, 2) DEFAULT '20',
	"heat_interval_days" integer DEFAULT 21 NOT NULL,
	"gestation_days" integer DEFAULT 280 NOT NULL,
	"dry_period_days" integer DEFAULT 60 NOT NULL,
	"pregnancy_test_days" integer DEFAULT 30 NOT NULL,
	"heifer_insemination_age_days" integer DEFAULT 365 NOT NULL,
	"cattle_limit_warning_percent" integer DEFAULT 80 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "farm_settings_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "feed_inventory" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"feed_item_id" varchar NOT NULL,
	"batch_number" text,
	"quantity" numeric(12, 2) NOT NULL,
	"unit_cost" numeric(10, 2),
	"purchase_date" date,
	"expiry_date" date,
	"supplier_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "feed_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"category" text NOT NULL,
	"unit" text DEFAULT 'kg' NOT NULL,
	"crude_protein" numeric(5, 2),
	"energy" numeric(6, 2),
	"dry_matter" numeric(5, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "feed_items_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "feeding_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"cattle_id" varchar,
	"feed_item_id" varchar NOT NULL,
	"date" date NOT NULL,
	"session" text NOT NULL,
	"planned_quantity" numeric(8, 2),
	"actual_quantity" numeric(8, 2) NOT NULL,
	"recorded_by" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "health_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"cattle_id" varchar NOT NULL,
	"event_type" text NOT NULL,
	"date" date NOT NULL,
	"description" text,
	"severity" text DEFAULT 'moderate',
	"symptoms" text,
	"diagnosis" text,
	"vet_id" varchar,
	"photo_urls" jsonb DEFAULT '[]'::jsonb,
	"status" text DEFAULT 'active' NOT NULL,
	"resolved_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "heats" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"cattle_id" varchar NOT NULL,
	"detected_at" timestamp NOT NULL,
	"detected_by" varchar,
	"intensity" text DEFAULT 'normal',
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "income_heads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"category" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "income_heads_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "incomes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"head_id" varchar NOT NULL,
	"date" date NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"description" text,
	"customer_name" text,
	"invoice_number" text,
	"payment_method" text DEFAULT 'cash',
	"reference_type" text,
	"reference_id" varchar,
	"recorded_by" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inseminations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"cattle_id" varchar NOT NULL,
	"heat_id" varchar,
	"date" date NOT NULL,
	"method" text DEFAULT 'ai' NOT NULL,
	"bull_id" varchar,
	"semen_batch_id" varchar,
	"technician_id" varchar,
	"cost" numeric(10, 2),
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inventory_categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"type" text NOT NULL,
	CONSTRAINT "inventory_categories_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"category_id" varchar,
	"name" text NOT NULL,
	"sku" text,
	"unit" text NOT NULL,
	"current_stock" numeric(14, 3) DEFAULT '0' NOT NULL,
	"min_stock" numeric(12, 2) DEFAULT '0',
	"max_stock" numeric(12, 2),
	"avg_cost" numeric(10, 2),
	"last_purchase_price" numeric(10, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inventory_transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"item_id" varchar NOT NULL,
	"type" text NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"unit_cost" numeric(10, 2),
	"total_cost" numeric(12, 2),
	"batch_number" text,
	"expiry_date" date,
	"reference_type" text,
	"reference_id" varchar,
	"notes" text,
	"recorded_by" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "medicines" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"category" text NOT NULL,
	"default_withdrawal_days" integer DEFAULT 0,
	"unit" text DEFAULT 'ml' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "medicines_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "milk_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"cattle_id" varchar NOT NULL,
	"date" date NOT NULL,
	"session" text NOT NULL,
	"destination" text DEFAULT 'bulk' NOT NULL,
	"quantity" numeric(8, 2) NOT NULL,
	"fat" numeric(4, 2),
	"snf" numeric(4, 2),
	"recorded_by" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "milk_sales" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"date" date NOT NULL,
	"buyer_name" text,
	"quantity" numeric(10, 2) NOT NULL,
	"price_per_liter" numeric(8, 2) NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"payment_status" text DEFAULT 'pending' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notification_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" text DEFAULT 'Notification rule' NOT NULL,
	"rule_type" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"days_before_event" integer DEFAULT 1,
	"offsets_days" jsonb DEFAULT '[0]'::jsonb,
	"cattle_id" varchar,
	"cattle_stage" text,
	"conditions" jsonb DEFAULT '{}'::jsonb,
	"severity" text DEFAULT 'warning' NOT NULL,
	"channels" jsonb DEFAULT '["app"]'::jsonb,
	"recipient_scope" text DEFAULT 'tenant_owner' NOT NULL,
	"custom_recipients" jsonb DEFAULT '[]'::jsonb,
	"message_template" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pregnancy_tests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"cattle_id" varchar NOT NULL,
	"insemination_id" varchar,
	"test_date" date NOT NULL,
	"result" text NOT NULL,
	"method" text DEFAULT 'rectal' NOT NULL,
	"tested_by" varchar,
	"expected_calving_date" date,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"max_cattle" integer NOT NULL,
	"max_users" integer DEFAULT 5 NOT NULL,
	"price_monthly" numeric(10, 2) NOT NULL,
	"price_yearly" numeric(10, 2),
	"features" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "subscription_plans_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value" text,
	"is_secret" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "system_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"due_date" date,
	"due_time" text,
	"assigned_to" varchar,
	"cattle_id" varchar,
	"is_recurring" boolean DEFAULT false,
	"recurring_pattern" text,
	"batch_id" varchar,
	"source_key" text,
	"trigger" text,
	"cycle_id" varchar,
	"protocol_id" varchar,
	"protocol_version" integer,
	"supplies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"clinical" jsonb,
	"evidence_required" boolean DEFAULT false NOT NULL,
	"evidence" jsonb,
	"reason" text,
	"original_due_date" date,
	"revision" integer DEFAULT 1 NOT NULL,
	"completed_at" timestamp,
	"completed_by" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tenant_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"role" text DEFAULT 'worker' NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tenant_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"accounting_mode" text DEFAULT 'simple' NOT NULL,
	"byproduct_inventory_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "tenant_settings_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "tenant_subscriptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"plan_id" varchar NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"grace_period_days" integer DEFAULT 7,
	"billing_cycle" text DEFAULT 'monthly' NOT NULL,
	"amount" numeric(10, 2),
	"payment_gateway" text,
	"external_subscription_id" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"owner_id" varchar NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"plan_expires_at" timestamp,
	"max_cattle" integer DEFAULT 2 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"address" text,
	"phone" text,
	"language" text DEFAULT 'en' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "treatments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"health_event_id" varchar NOT NULL,
	"medicine_id" varchar,
	"medicine_name" text,
	"dosage" text,
	"route" text,
	"date" date NOT NULL,
	"administered_by" varchar,
	"withdrawal_days" integer DEFAULT 0,
	"withdrawal_ends_at" date,
	"cost" numeric(10, 2),
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vaccinations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"cattle_id" varchar NOT NULL,
	"vaccine_id" varchar,
	"vaccine_name" text NOT NULL,
	"date" date NOT NULL,
	"batch_number" text,
	"next_due_date" date,
	"administered_by" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vaccines" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"disease_target" text,
	"frequency_days" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "vaccines_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_configs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"mode" text DEFAULT 'disabled' NOT NULL,
	"web_session_status" text DEFAULT 'disconnected',
	"web_qr_code" text,
	"web_phone_number" text,
	"web_last_connected" timestamp,
	"api_provider" text,
	"api_key" text,
	"api_phone_number_id" text,
	"api_business_account_id" text,
	"api_webhook_secret" text,
	"from_phone_number" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "whatsapp_configs_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"to_phone" text NOT NULL,
	"message_type" text NOT NULL,
	"template_name" text,
	"message" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"external_message_id" text,
	"error_message" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp DEFAULT now(),
	"trigger_type" text,
	"reference_type" text,
	"reference_id" varchar,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"password_hash" varchar,
	"google_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id")
);
--> statement-breakpoint
CREATE TABLE "animal_groups" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'manual' NOT NULL,
	"cattle_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"criteria" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "care_protocols" (
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
--> statement-breakpoint
CREATE TABLE "daily_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"date" date NOT NULL,
	"revision" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"generated_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diet_plans" (
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
--> statement-breakpoint
CREATE TABLE "farm_events" (
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
--> statement-breakpoint
CREATE TABLE "operation_receipts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"key" text NOT NULL,
	"request_hash" text NOT NULL,
	"response" jsonb,
	"status_code" integer DEFAULT 200 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_schedules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"cutoff" text DEFAULT '23:00' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_date" date,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_ledger" (
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
--> statement-breakpoint
CREATE TABLE "stock_lots" (
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
--> statement-breakpoint
CREATE TABLE "work_batches" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"title" text NOT NULL,
	"group_id" varchar,
	"date" date NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_cattle_id_cattle_id_fk" FOREIGN KEY ("cattle_id") REFERENCES "public"."cattle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachment_links" ADD CONSTRAINT "attachment_links_attachment_id_attachments_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."attachments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "byproduct_inventory" ADD CONSTRAINT "byproduct_inventory_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "byproduct_inventory" ADD CONSTRAINT "byproduct_inventory_byproduct_type_id_byproduct_types_id_fk" FOREIGN KEY ("byproduct_type_id") REFERENCES "public"."byproduct_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "byproduct_transactions" ADD CONSTRAINT "byproduct_transactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "byproduct_transactions" ADD CONSTRAINT "byproduct_transactions_byproduct_type_id_byproduct_types_id_fk" FOREIGN KEY ("byproduct_type_id") REFERENCES "public"."byproduct_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calvings" ADD CONSTRAINT "calvings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calvings" ADD CONSTRAINT "calvings_cattle_id_cattle_id_fk" FOREIGN KEY ("cattle_id") REFERENCES "public"."cattle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cattle" ADD CONSTRAINT "cattle_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cattle" ADD CONSTRAINT "cattle_breed_id_breeds_id_fk" FOREIGN KEY ("breed_id") REFERENCES "public"."breeds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cattle_costs" ADD CONSTRAINT "cattle_costs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cattle_costs" ADD CONSTRAINT "cattle_costs_cattle_id_cattle_id_fk" FOREIGN KEY ("cattle_id") REFERENCES "public"."cattle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cattle_payments" ADD CONSTRAINT "cattle_payments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cattle_payments" ADD CONSTRAINT "cattle_payments_transaction_id_cattle_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."cattle_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cattle_transactions" ADD CONSTRAINT "cattle_transactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cattle_transactions" ADD CONSTRAINT "cattle_transactions_cattle_id_cattle_id_fk" FOREIGN KEY ("cattle_id") REFERENCES "public"."cattle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_head_id_expense_heads_id_fk" FOREIGN KEY ("head_id") REFERENCES "public"."expense_heads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_settings" ADD CONSTRAINT "farm_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_inventory" ADD CONSTRAINT "feed_inventory_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_inventory" ADD CONSTRAINT "feed_inventory_feed_item_id_feed_items_id_fk" FOREIGN KEY ("feed_item_id") REFERENCES "public"."feed_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feeding_records" ADD CONSTRAINT "feeding_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feeding_records" ADD CONSTRAINT "feeding_records_cattle_id_cattle_id_fk" FOREIGN KEY ("cattle_id") REFERENCES "public"."cattle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feeding_records" ADD CONSTRAINT "feeding_records_feed_item_id_feed_items_id_fk" FOREIGN KEY ("feed_item_id") REFERENCES "public"."feed_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_events" ADD CONSTRAINT "health_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_events" ADD CONSTRAINT "health_events_cattle_id_cattle_id_fk" FOREIGN KEY ("cattle_id") REFERENCES "public"."cattle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heats" ADD CONSTRAINT "heats_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heats" ADD CONSTRAINT "heats_cattle_id_cattle_id_fk" FOREIGN KEY ("cattle_id") REFERENCES "public"."cattle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_head_id_income_heads_id_fk" FOREIGN KEY ("head_id") REFERENCES "public"."income_heads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inseminations" ADD CONSTRAINT "inseminations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inseminations" ADD CONSTRAINT "inseminations_cattle_id_cattle_id_fk" FOREIGN KEY ("cattle_id") REFERENCES "public"."cattle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inseminations" ADD CONSTRAINT "inseminations_heat_id_heats_id_fk" FOREIGN KEY ("heat_id") REFERENCES "public"."heats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_category_id_inventory_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."inventory_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milk_entries" ADD CONSTRAINT "milk_entries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milk_entries" ADD CONSTRAINT "milk_entries_cattle_id_cattle_id_fk" FOREIGN KEY ("cattle_id") REFERENCES "public"."cattle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milk_sales" ADD CONSTRAINT "milk_sales_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_rules" ADD CONSTRAINT "notification_rules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_rules" ADD CONSTRAINT "notification_rules_cattle_id_cattle_id_fk" FOREIGN KEY ("cattle_id") REFERENCES "public"."cattle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pregnancy_tests" ADD CONSTRAINT "pregnancy_tests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pregnancy_tests" ADD CONSTRAINT "pregnancy_tests_cattle_id_cattle_id_fk" FOREIGN KEY ("cattle_id") REFERENCES "public"."cattle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pregnancy_tests" ADD CONSTRAINT "pregnancy_tests_insemination_id_inseminations_id_fk" FOREIGN KEY ("insemination_id") REFERENCES "public"."inseminations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_cattle_id_cattle_id_fk" FOREIGN KEY ("cattle_id") REFERENCES "public"."cattle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_subscriptions" ADD CONSTRAINT "tenant_subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_subscriptions" ADD CONSTRAINT "tenant_subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatments" ADD CONSTRAINT "treatments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatments" ADD CONSTRAINT "treatments_health_event_id_health_events_id_fk" FOREIGN KEY ("health_event_id") REFERENCES "public"."health_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatments" ADD CONSTRAINT "treatments_medicine_id_medicines_id_fk" FOREIGN KEY ("medicine_id") REFERENCES "public"."medicines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_cattle_id_cattle_id_fk" FOREIGN KEY ("cattle_id") REFERENCES "public"."cattle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_vaccine_id_vaccines_id_fk" FOREIGN KEY ("vaccine_id") REFERENCES "public"."vaccines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_configs" ADD CONSTRAINT "whatsapp_configs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_logs" ADD CONSTRAINT "whatsapp_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_tenant_idx" ON "alerts" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "alerts_dedupe_key_idx" ON "alerts" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "attachment_links_entity_idx" ON "attachment_links" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "attachments_tenant_idx" ON "attachments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "audit_tenant_idx" ON "audit_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "byproduct_inv_tenant_idx" ON "byproduct_inventory" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "byproduct_inv_unique_idx" ON "byproduct_inventory" USING btree ("tenant_id","byproduct_type_id");--> statement-breakpoint
CREATE INDEX "byproduct_tx_tenant_idx" ON "byproduct_transactions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "byproduct_tx_type_idx" ON "byproduct_transactions" USING btree ("byproduct_type_id");--> statement-breakpoint
CREATE INDEX "cattle_tenant_idx" ON "cattle" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "cattle_tag_idx" ON "cattle" USING btree ("tenant_id","tag_number");--> statement-breakpoint
CREATE INDEX "cattle_costs_tenant_idx" ON "cattle_costs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "cattle_costs_cattle_idx" ON "cattle_costs" USING btree ("cattle_id");--> statement-breakpoint
CREATE INDEX "cattle_tx_tenant_idx" ON "cattle_transactions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "cattle_tx_cattle_idx" ON "cattle_transactions" USING btree ("cattle_id");--> statement-breakpoint
CREATE INDEX "milk_tenant_date_idx" ON "milk_entries" USING btree ("tenant_id","date");--> statement-breakpoint
CREATE INDEX "milk_cattle_date_idx" ON "milk_entries" USING btree ("cattle_id","date");--> statement-breakpoint
CREATE INDEX "notif_rules_tenant_idx" ON "notification_rules" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "notif_rules_type_idx" ON "notification_rules" USING btree ("rule_type");--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_source_key_idx" ON "tasks" USING btree ("tenant_id","source_key");--> statement-breakpoint
CREATE INDEX "tenant_sub_tenant_idx" ON "tenant_subscriptions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "whatsapp_logs_tenant_idx" ON "whatsapp_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE UNIQUE INDEX "protocol_version_idx" ON "care_protocols" USING btree ("tenant_id","family_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_report_revision_idx" ON "daily_reports" USING btree ("tenant_id","date","revision");--> statement-breakpoint
CREATE INDEX "farm_events_tenant_date_idx" ON "farm_events" USING btree ("tenant_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "operation_receipt_key_idx" ON "operation_receipts" USING btree ("tenant_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "report_schedule_tenant_idx" ON "report_schedules" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "stock_lots_item_idx" ON "stock_lots" USING btree ("tenant_id","item_id");