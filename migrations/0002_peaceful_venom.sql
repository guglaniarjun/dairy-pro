BEGIN;
ALTER TABLE sales_payments ALTER COLUMN sale_id DROP NOT NULL;
ALTER TABLE dairy_sales ADD COLUMN IF NOT EXISTS received_amount numeric(14, 2) DEFAULT '0' NOT NULL;
ALTER TABLE dairy_sales ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE sales_customers ADD COLUMN IF NOT EXISTS payment_term text DEFAULT 'immediate' NOT NULL;
ALTER TABLE sales_customers ADD COLUMN IF NOT EXISTS payment_days integer DEFAULT 0 NOT NULL;
-- Transform legacy values once; preserve every original receipt and reference.
UPDATE sales_customers SET payment_term = 'monthly', payment_mode = 'credit'
WHERE payment_mode = 'monthly_credit';
UPDATE sales_customers SET payment_mode = 'credit' WHERE payment_type = 'credit' AND payment_term = 'immediate';
UPDATE dairy_sales SET received_amount = COALESCE((
  SELECT SUM(p.amount) FROM sales_payments p
  WHERE p.tenant_id = dairy_sales.tenant_id AND p.sale_id = dairy_sales.id
    AND p.date = dairy_sales.date
), 0), due_date = CASE WHEN c.payment_term = 'monthly'
  THEN (date_trunc('month', dairy_sales.date) + interval '1 month - 1 day')::date
  ELSE dairy_sales.date END
FROM sales_customers c WHERE c.id = dairy_sales.customer_id AND c.tenant_id = dairy_sales.tenant_id AND dairy_sales.due_date IS NULL;
COMMIT;
