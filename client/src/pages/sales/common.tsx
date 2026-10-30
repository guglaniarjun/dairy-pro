import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { queryClient } from "@/lib/queryClient";
import { farmDay } from "@shared/care";
import { cents, decimal, paymentLabel } from "@shared/sales";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/farm-forms";
export const currency = (n: string | number) =>
  Number(n).toLocaleString("en-IN", { style: "currency", currency: "INR" });
export function AccountBalance({ balance }: { balance: string | number }) {
  const amount = Number(balance || 0);
  return (
    <span
      className={`font-semibold whitespace-nowrap ${amount < 0 ? "text-emerald-700 dark:text-emerald-400" : amount > 0 ? "text-red-700 dark:text-red-400" : "text-muted-foreground"}`}
    >
      {amount < 0 ? "Advance" : amount > 0 ? "Due" : "Settled"}{" "}
      {currency(Math.abs(amount))}
    </span>
  );
}
export function useSales(date = farmDay()) {
  const { user } = useAuth();
  const permissions = (user as any)?.tenantPermissions || [];
  const canView = permissions.includes("sales.view");
  const canManage = permissions.includes("sales.manage");
  const query = useQuery<any>({
    queryKey: [`/api/sales?date=${date}`],
    enabled: canView,
  });
  return { ...query, canView, canManage };
}
// Retain the same key after a lost response; editing the payload creates a new operation.
export function useSalesWrite() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const retry = useRef({ signature: "", key: "" });
  const lock = useRef(false);
  const save = async (url: string, data: any, method = "POST") => {
    if (lock.current) return null;
    lock.current = true;
    setBusy(true);
    setError("");
    setSuccess("");
    const user = queryClient.getQueryData<any>(["/api/auth/user"]);
    const signature = JSON.stringify({
      url,
      method,
      data,
      user: user?.id,
      tenant: user?.tenantId,
    });
    if (retry.current.signature !== signature)
      retry.current = { signature, key: crypto.randomUUID() };
    try {
      const response = await fetch(url, {
        method,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": retry.current.key,
          ...(user?.tenantId ? { "X-Farm-ID": user.tenantId } : {}),
        },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save");
      await queryClient.invalidateQueries();
      retry.current = { signature: "", key: "" };
      setSuccess("Saved successfully.");
      return result;
    } catch (e: any) {
      setError(
        e.message ||
          "Connection lost. Retry this entry to confirm whether it saved.",
      );
      return null;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return {
    busy,
    save,
    message: (
      <>
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-destructive/10 p-3 text-destructive text-sm"
          >
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="text-sm text-emerald-700">
            {success}
          </p>
        )}
      </>
    ),
  };
}
export function SalesSetup({ onSetup }: { onSetup?: () => void }) {
  const write = useSalesWrite();
  return (
    <Panel
      title="Set up your sales items"
      description="Start with Milk, Paneer, Curd, Ghee, Butter and Cream. Set your own rates in Items & stock before entering sales."
    >
      {write.message}
      <Button
        disabled={write.busy}
        onClick={async () => {
          if (await write.save("/api/sales/setup", {})) onSetup?.();
        }}
      >
        Set up dairy products
      </Button>
    </Panel>
  );
}
export function SalesTable({ entries = [] }: { entries?: any[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="border-b bg-muted/40">
          <tr>
            {[
              "Date",
              "Customer",
              "Item",
              "Quantity",
              "Rate",
              "Total",
              "Settled",
              "From advance",
              "Due",
              "Due date",
              "Payment",
            ].map((h) => (
              <th className="p-3 whitespace-nowrap" key={h}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((s) => (
            <tr key={s.id} className="border-b">
              <td className="p-3 whitespace-nowrap">{s.date}</td>
              <td className="p-3">{s.customerName}</td>
              <td className="p-3">{s.productName}</td>
              <td className="p-3 whitespace-nowrap">
                {s.quantity} {s.unit}
              </td>
              <td className="p-3">{currency(s.rate)}</td>
              <td className="p-3 font-medium">{currency(s.totalAmount)}</td>
              <td className="p-3">{currency(s.paidAmount)}</td>
              <td className="p-3 text-emerald-700 dark:text-emerald-400">
                {currency(s.advanceApplied || 0)}
              </td>
              <td className="p-3">
                {currency(
                  s.outstanding ??
                    decimal(cents(s.totalAmount) - cents(s.paidAmount)),
                )}
              </td>
              <td className="p-3 whitespace-nowrap">
                {Number(s.outstanding) > 0 ? s.dueDate || s.date : "—"}
              </td>
              <td className="p-3">{paymentLabel(s.paymentMode)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!entries.length && (
        <p className="py-6 text-muted-foreground">
          No sales for this selection.
        </p>
      )}
    </div>
  );
}
