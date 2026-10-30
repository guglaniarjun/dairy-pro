import {
  pgTable,
  varchar,
  text,
  boolean,
  decimal,
  date,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
const id = () =>
  varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`);
const tenant = () => varchar("tenant_id").notNull();
const money = (name: string) => decimal(name, { precision: 14, scale: 2 });
export const salesProducts = pgTable(
  "sales_products",
  {
    id: id(),
    tenantId: tenant(),
    name: text("name").notNull(),
    code: text("code").notNull(),
    unit: text("unit").notNull(),
    isMilk: boolean("is_milk").notNull().default(false),
    defaultRate: money("default_rate").notNull().default("0"),
    active: boolean("active").notNull().default(true),
  },
  (t) => [uniqueIndex("sales_product_code_idx").on(t.tenantId, t.code)],
);
export const salesCustomers = pgTable(
  "sales_customers",
  {
    id: id(),
    tenantId: tenant(),
    name: text("name").notNull(),
    phone: text("phone"),
    address: text("address"),
    daily: boolean("daily").notNull().default(true),
    active: boolean("active").notNull().default(true),
    defaultProductId: varchar("default_product_id"),
    defaultQuantity: money("default_quantity"),
    defaultRate: money("default_rate"),
    paymentType: text("payment_type").notNull().default("cash"),
    paymentMode: text("payment_mode").notNull().default("cash"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("sales_customers_tenant_idx").on(t.tenantId)],
);
export const dairySales = pgTable(
  "dairy_sales",
  {
    id: id(),
    tenantId: tenant(),
    entryKey: text("entry_key").notNull(),
    source: text("source").notNull(),
    date: date("date").notNull(),
    customerId: varchar("customer_id").notNull(),
    customerName: text("customer_name").notNull(),
    productId: varchar("product_id").notNull(),
    productName: text("product_name").notNull(),
    unit: text("unit").notNull(),
    quantity: money("quantity").notNull(),
    rate: money("rate").notNull(),
    totalAmount: money("total_amount").notNull(),
    paidAmount: money("paid_amount").notNull().default("0"),
    paymentType: text("payment_type").notNull(),
    paymentMode: text("payment_mode").notNull(),
    milkSaleId: varchar("milk_sale_id"),
    notes: text("notes"),
    recordedBy: varchar("recorded_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("dairy_sales_entry_idx").on(t.tenantId, t.entryKey),
    index("dairy_sales_date_idx").on(t.tenantId, t.date),
  ],
);
export const salesPayments = pgTable(
  "sales_payments",
  {
    id: id(),
    tenantId: tenant(),
    saleId: varchar("sale_id").notNull(),
    customerId: varchar("customer_id").notNull(),
    date: date("date").notNull(),
    amount: money("amount").notNull(),
    mode: text("mode").notNull(),
    reference: text("reference"),
    recordedBy: varchar("recorded_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("sales_payments_date_idx").on(t.tenantId, t.date)],
);
export const productStock = pgTable(
  "product_stock",
  {
    id: id(),
    tenantId: tenant(),
    productId: varchar("product_id").notNull(),
    date: date("date").notNull(),
    quantity: money("quantity").notNull(),
    kind: text("kind").notNull(),
    saleId: varchar("sale_id"),
    milkUsed: money("milk_used").notNull().default("0"),
    notes: text("notes"),
    recordedBy: varchar("recorded_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("product_stock_date_idx").on(t.tenantId, t.productId, t.date)],
);
