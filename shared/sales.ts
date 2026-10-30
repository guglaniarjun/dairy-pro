import { z } from "zod";
import { daySchema, addDays } from "./care";
export const paymentModes = [
  "cash",
  "upi",
  "bank_transfer",
  "cheque",
  "credit",
  "other",
] as const;
export const modeOptions = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "bank_transfer", label: "Account transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "credit", label: "Credit / Pay later" },
  { value: "other", label: "Other" },
];
const paymentModeSchema = z.preprocess(
  (v) => (v === "monthly_credit" ? "credit" : v),
  z.enum(paymentModes),
);
export const paymentLabel = (mode: string) =>
  mode === "advance"
    ? "Paid from advance"
    : mode === "monthly_credit"
      ? "Credit / Pay later"
      : modeOptions.find((m) => m.value === mode)?.label || mode;
export function paymentDueDate(date: string, term: string, days: number) {
  if (term === "monthly") {
    const d = new Date(`${date}T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + 1, 0);
    return d.toISOString().slice(0, 10);
  }
  return addDays(date, term === "days" ? days : 0);
}
export const cents = (v: string | number) => Math.round(Number(v) * 100);
export const decimal = (v: number) => (v / 100).toFixed(2);
export const lineTotal = (quantity: string | number, rate: string | number) =>
  Math.round((cents(quantity) * cents(rate)) / 100);
const amount = z.coerce
  .number()
  .finite()
  .min(0)
  .max(100000000)
  .refine(
    (n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.00001,
    "Use at most two decimal places",
  );
const quantity = amount.refine(
  (n) => n > 0 && n <= 100000,
  "Quantity must be between 0.01 and 100,000",
);
const rate = amount.refine(
  (n) => n > 0 && n <= 100000,
  "Set a rate between 0.01 and 100,000",
);
const optionalAmount = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  amount.nullable(),
);
export const customerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).default(""),
  address: z.string().trim().max(500).default(""),
  daily: z.boolean().default(true),
  active: z.boolean().default(true),
  defaultProductId: z.string().nullable().default(null),
  defaultQuantity: optionalAmount,
  defaultRate: optionalAmount,
  paymentType: z.enum(["cash", "credit"]).optional(),
  paymentMode: paymentModeSchema.default("credit"),
  paymentTerm: z.enum(["immediate", "days", "monthly"]).default("immediate"),
  paymentDays: z.coerce.number().int().min(0).max(365).default(0),
  notes: z.string().max(1000).default(""),
});
export const productSchema = z.object({
  name: z.string().trim().min(1).max(80),
  unit: z.enum(["litre", "kg", "piece", "pack"]),
  defaultRate: amount,
  active: z.boolean().default(true),
});
export const saleSchema = z
  .object({
    customerId: z.string().min(1),
    productId: z.string().min(1),
    quantity,
    rate,
    paymentType: z.enum(["cash", "credit"]).optional(),
    paymentMode: paymentModeSchema,
    receivedAmount: amount.optional(),
    expectedBalance: z.coerce.number().finite().optional(),
    paidAmount: amount.default(0),
    reference: z.string().trim().max(150).default(""),
    notes: z.string().trim().max(1000).default(""),
  })
  .superRefine((v, ctx) => {
    if (v.paymentType === "cash" && v.paymentMode === "credit")
      ctx.addIssue({
        code: "custom",
        message: "Choose a receipt mode for a cash sale",
      });
    if ((v.receivedAmount ?? v.paidAmount) > 0 && v.paymentMode === "credit")
      ctx.addIssue({
        code: "custom",
        message: "Choose how the part payment was received",
      });
    if (
      lineTotal(v.quantity, v.rate) < 1 ||
      lineTotal(v.quantity, v.rate) > 10000000000
    )
      ctx.addIssue({
        code: "custom",
        message: "Sale total must be between ₹0.01 and ₹100,000,000",
      });
  });
export const salesBatchSchema = z.object({
  date: daySchema,
  source: z.enum(["daily", "individual"]),
  entries: z.array(saleSchema).min(1).max(1000),
});
export const stockReceiptSchema = z.object({
  productId: z.string().min(1),
  date: daySchema,
  quantity,
  kind: z.enum(["opening", "purchase", "production"]),
  milkUsed: amount.default(0),
  notes: z.string().trim().min(1, "Add a source or batch reference").max(1000),
});
export const paymentSchema = z.object({
  customerId: z.string().min(1),
  date: daySchema,
  amount: amount.refine((n) => n > 0, "Enter a positive payment"),
  mode: z.enum(["cash", "upi", "bank_transfer", "cheque", "other"]),
  reference: z.string().trim().max(150).default(""),
});
