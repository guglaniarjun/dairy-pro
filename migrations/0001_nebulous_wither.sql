BEGIN;
CREATE TABLE IF NOT EXISTS "dairy_sales" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"entry_key" text NOT NULL,
	"source" text NOT NULL,
	"date" date NOT NULL,
	"customer_id" varchar NOT NULL,
	"customer_name" text NOT NULL,
	"product_id" varchar NOT NULL,
	"product_name" text NOT NULL,
	"unit" text NOT NULL,
	"quantity" numeric(14, 2) NOT NULL,
	"rate" numeric(14, 2) NOT NULL,
	"total_amount" numeric(14, 2) NOT NULL,
	"paid_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"payment_type" text NOT NULL,
	"payment_mode" text NOT NULL,
	"milk_sale_id" varchar,
	"notes" text,
	"recorded_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_stock" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"product_id" varchar NOT NULL,
	"date" date NOT NULL,
	"quantity" numeric(14, 2) NOT NULL,
	"kind" text NOT NULL,
	"sale_id" varchar,
	"milk_used" numeric(14, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"recorded_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sales_customers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"address" text,
	"daily" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"default_product_id" varchar,
	"default_quantity" numeric(14, 2),
	"default_rate" numeric(14, 2),
	"payment_type" text DEFAULT 'cash' NOT NULL,
	"payment_mode" text DEFAULT 'cash' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sales_payments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"sale_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"date" date NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"mode" text NOT NULL,
	"reference" text,
	"recorded_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sales_products" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"unit" text NOT NULL,
	"is_milk" boolean DEFAULT false NOT NULL,
	"default_rate" numeric(14, 2) DEFAULT '0' NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "dairy_sales_entry_idx" ON "dairy_sales" USING btree ("tenant_id","entry_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dairy_sales_date_idx" ON "dairy_sales" USING btree ("tenant_id","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_stock_date_idx" ON "product_stock" USING btree ("tenant_id","product_id","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sales_customers_tenant_idx" ON "sales_customers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sales_payments_date_idx" ON "sales_payments" USING btree ("tenant_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sales_product_code_idx" ON "sales_products" USING btree ("tenant_id","code");
COMMIT;
