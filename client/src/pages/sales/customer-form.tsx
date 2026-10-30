import { useState } from "react";
import { InputField, SelectField } from "@/components/farm-forms";
import { Button } from "@/components/ui/button";
import { modeOptions } from "@shared/sales";
import { useSalesWrite } from "./common";
export function CustomerForm({ customer, products, onSaved }: any) {
  const write = useSalesWrite();
  const [terms, setTerms] = useState(customer?.paymentType || "cash");
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const d: any = Object.fromEntries(new FormData(form));
        const result = await write.save(
          `/api/sales/customers${customer ? `/${customer.id}` : ""}`,
          {
            ...d,
            daily: d.daily === "on",
            active: d.active === "on",
            defaultProductId: d.defaultProductId || null,
          },
          customer ? "PATCH" : "POST",
        );
        if (result) onSaved(result);
      }}
    >
      <fieldset disabled={write.busy} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <InputField
            label="Customer name *"
            name="name"
            required
            maxLength={120}
            defaultValue={customer?.name}
          />
          <InputField
            label="Phone"
            name="phone"
            maxLength={40}
            defaultValue={customer?.phone}
          />
        </div>
        <InputField
          label="Address"
          name="address"
          maxLength={500}
          defaultValue={customer?.address}
        />
        <div className="grid sm:grid-cols-3 gap-4">
          <SelectField
            label="Default item"
            name="defaultProductId"
            defaultValue={
              customer?.defaultProductId ||
              products.find((p: any) => p.isMilk)?.id
            }
            options={products
              .filter((p: any) => p.active)
              .map((p: any) => ({
                value: p.id,
                label: `${p.name} (${p.unit})`,
              }))}
          />
          <InputField
            label="Usual daily quantity (optional)"
            name="defaultQuantity"
            type="number"
            min="0"
            step="0.01"
            defaultValue={customer?.defaultQuantity}
          />
          <InputField
            label="Customer rate (optional)"
            name="defaultRate"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Use item's default"
            defaultValue={customer?.defaultRate}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          A customer rate applies to their default item. Other items use their
          own default rates.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <SelectField
            label="Default terms"
            name="paymentType"
            value={terms}
            onChange={(e: any) => setTerms(e.target.value)}
            required
            options={[
              { value: "cash", label: "Cash (paid in full)" },
              { value: "credit", label: "Credit" },
            ]}
          />
          <SelectField
            key={terms}
            label="Default payment mode"
            name="paymentMode"
            required
            defaultValue={
              customer?.paymentType === terms
                ? customer.paymentMode
                : terms === "credit"
                  ? "monthly_credit"
                  : "cash"
            }
            options={modeOptions.filter(
              (m) => terms === "credit" || m.value !== "monthly_credit",
            )}
          />
        </div>
        <InputField
          label="Notes"
          name="notes"
          maxLength={1000}
          defaultValue={customer?.notes}
        />
        <div className="flex flex-wrap gap-6 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="daily"
              defaultChecked={customer?.daily ?? true}
            />{" "}
            Show in daily sales grid
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="active"
              defaultChecked={customer?.active ?? true}
            />{" "}
            Active customer
          </label>
        </div>
        {write.message}
        <Button type="submit">
          {write.busy ? "Saving…" : customer ? "Save customer" : "Add customer"}
        </Button>
      </fieldset>
    </form>
  );
}
