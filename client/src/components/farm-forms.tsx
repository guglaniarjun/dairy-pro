import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
export const control =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-10";
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5 text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function InputField({ label, name, type = "text", ...props }: any) {
  return (
    <Field label={label}>
      <input className={control} name={name} type={type} {...props} />
    </Field>
  );
}
export function SelectField({ label, name, options, ...props }: any) {
  return (
    <Field label={label}>
      <select className={control} name={name} {...props}>
        {!options.some((o: any) => typeof o !== "string" && o.value === "") && (
          <option value="">Select…</option>
        )}
        {options.map((o: any) => (
          <option
            key={typeof o === "string" ? o : o.value}
            value={typeof o === "string" ? o : o.value}
          >
            {typeof o === "string" ? o.replaceAll("_", " ") : o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
export function Panel({ title, children, description }: any) {
  return (
    <section className="min-w-0 rounded-xl border bg-card p-4 sm:p-5 space-y-4">
      <div>
        <h2 className="font-semibold text-lg">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}
export function EntryForm({
  children,
  onSave,
  label = "Save",
  reset = true,
}: {
  children: ReactNode;
  onSave: (data: any) => Promise<any>;
  label?: string;
  reset?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        setBusy(true);
        setError("");
        setSuccess("");
        try {
          const result = await onSave(Object.fromEntries(new FormData(form)));
          setSuccess(
            result?.queued
              ? "Saved on this device. Sync it when online."
              : "Saved successfully.",
          );
          if (reset) form.reset();
        } catch (error: any) {
          setError(error.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {children}
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-destructive/10 p-3 text-destructive text-sm"
        >
          {error}
        </p>
      )}
      {success && (
        <p
          role="status"
          className="text-sm text-emerald-700 dark:text-emerald-400"
        >
          {success}
        </p>
      )}
      <Button disabled={busy} type="submit">
        {busy ? "Saving…" : label}
      </Button>
    </form>
  );
}
export function Supplies({
  items,
  value,
  onChange,
  label = "Supplies per animal",
}: any) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{label}</p>
      {value.map((v: any, i: number) => (
        <div className="grid grid-cols-[minmax(0,1fr)_85px_30px] gap-2" key={i}>
          <select
            aria-label={`Supply ${i + 1}`}
            className={control}
            required
            value={v.itemId}
            onChange={(e) =>
              onChange(
                value.map((r: any, n: number) =>
                  n === i ? { ...r, itemId: e.target.value } : r,
                ),
              )
            }
          >
            <option value="">Choose item</option>
            {items.map((item: any) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.unit})
              </option>
            ))}
          </select>
          <input
            aria-label={`Quantity ${i + 1}`}
            className={control}
            type="number"
            min="0.001"
            step="0.001"
            required
            value={v.quantity}
            onChange={(e) =>
              onChange(
                value.map((r: any, n: number) =>
                  n === i ? { ...r, quantity: e.target.value } : r,
                ),
              )
            }
          />
          <button
            type="button"
            aria-label={`Remove supply ${i + 1}`}
            onClick={() =>
              onChange(value.filter((_: any, n: number) => n !== i))
            }
          >
            ×
          </button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...value, { itemId: "", quantity: "" }])}
      >
        Add item
      </Button>
      <p className="text-xs text-muted-foreground">
        Use the item's base unit. Medicine quantities must follow the approved
        prescription.
      </p>
    </div>
  );
}
export function AnimalChecks({ animals, value, onChange }: any) {
  return (
    <div className="max-h-60 overflow-auto border rounded-lg p-3 grid sm:grid-cols-2 gap-2">
      {animals.map((a: any) => (
        <label key={a.id} className="flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.includes(a.id)}
            onChange={(e) =>
              onChange(
                e.target.checked
                  ? [...value, a.id]
                  : value.filter((id: string) => id !== a.id),
              )
            }
          />
          {a.tagNumber} {a.name ? `· ${a.name}` : ""}
        </label>
      ))}
    </div>
  );
}
export function Details({ value }: any) {
  if (value == null) return null;
  if (Array.isArray(value))
    return (
      <div className="space-y-2">
        {value.map((v, i) => (
          <Details key={i} value={v} />
        ))}
      </div>
    );
  if (typeof value === "object")
    return (
      <dl className="space-y-1 text-xs">
        {Object.entries(value)
          .filter(
            ([k, v]) =>
              v != null &&
              v !== "" &&
              !["tenantId", "passwordHash"].includes(k),
          )
          .map(([k, v]) => (
            <div key={k} className="grid grid-cols-[130px_1fr] gap-2">
              <dt className="text-muted-foreground break-words">
                {k.replace(/([A-Z])/g, " $1")}
              </dt>
              <dd className="break-words min-w-0">
                {typeof v === "object" ? <Details value={v} /> : String(v)}
              </dd>
            </div>
          ))}
      </dl>
    );
  return <span>{String(value)}</span>;
}
