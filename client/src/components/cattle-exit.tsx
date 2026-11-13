import { EntryForm, InputField, SelectField } from "./farm-forms";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { farmDay } from "@shared/care";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
export function CattleExit({ animal }: { animal: any }) {
  const { user } = useAuth();
  const permissions = (user as any)?.tenantPermissions || [];
  const history = useQuery<any[]>({ queryKey: ["/api/operations/events"] });
  const transactions = useQuery<any[]>({
    queryKey: ["/api/cattle-transactions"],
    enabled: permissions.includes("finances.view"),
  });
  if (!permissions.includes("cattle.manage")) return null;
  return (
    <details className="rounded-lg border p-4">
      <summary className="cursor-pointer font-medium">
        Animal exit, archive and reactivation
      </summary>
      <p className="text-sm my-3">
        Records remain in the animal's history. Record a sale through{" "}
        <Link className="underline" href={`/cattle/sale?cattleId=${animal.id}`}>
          Cattle sale
        </Link>{" "}
        to include its payment.
      </p>
      <EntryForm
        label={animal.status === "active" ? "Record exit" : "Reactivate animal"}
        onSave={async (data) => {
          const r = await apiRequest(
            "POST",
            `/api/operations/cattle/${animal.id}/status`,
            {
              ...data,
              revision: animal.revision,
              status: animal.status === "active" ? data.status : "active",
            },
          );
          await queryClient.invalidateQueries();
          return r.json();
        }}
      >
        {animal.status === "active" && (
          <SelectField
            name="status"
            label="Reason for leaving the active herd"
            options={["dead", "culled", "inactive", "transferred", "archived"]}
            required
          />
        )}
        <InputField
          name="date"
          label="Actual date"
          type="date"
          defaultValue={farmDay()}
          required
        />
        <InputField
          name="reason"
          label="Reason, cause or correction details"
          required
        />
        <InputField name="reference" label="Supporting reference (optional)" />
      </EntryForm>
      {(history.data || [])
        .filter((e) => e.cattleId === animal.id && e.type === "animal_status")
        .map((e) => (
          <p className="text-sm mt-2" key={e.id}>
            {e.date}: {e.payload.before?.status} → {e.payload.status}.{" "}
            {e.payload.reason}
          </p>
        ))}
      {(transactions.data || [])
        .filter((t) => t.cattleId === animal.id)
        .map((t) => (
          <details className="border rounded p-3 mt-3" key={t.id}>
            <summary>
              {t.date} · {t.type} · ₹{t.amount} · {t.paymentStatus}
            </summary>
            {t.paymentStatus !== "voided" &&
              permissions.includes("finances.manage") && (
                <EntryForm
                  label="Reverse incorrect record"
                  onSave={async (d) => {
                    const r = await apiRequest(
                      "POST",
                      `/api/operations/cattle-transactions/${t.id}/void`,
                      { ...d, confirmIncorrectRecord: d.confirm === "yes" },
                    );
                    await queryClient.invalidateQueries();
                    return r.json();
                  }}
                >
                  <p className="text-sm">
                    Use this for an incorrect entry. It reverses its ledger
                    payments and restores a sold animal to active. It does not
                    transfer money.
                  </p>
                  <InputField
                    label="Correction date"
                    name="date"
                    type="date"
                    defaultValue={farmDay()}
                    required
                  />
                  <InputField
                    label="Reason and supporting reference"
                    name="reason"
                    required
                  />
                  <SelectField
                    label="I have verified that this record is incorrect"
                    name="confirm"
                    options={[
                      { value: "yes", label: "Yes, reverse this record" },
                    ]}
                    required
                  />
                </EntryForm>
              )}
          </details>
        ))}
    </details>
  );
}
