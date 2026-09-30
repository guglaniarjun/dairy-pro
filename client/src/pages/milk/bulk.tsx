import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  Panel,
  InputField,
  SelectField,
  EntryForm,
  control,
} from "@/components/farm-forms";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { saveOfflineOperation, OfflineStatus } from "@/lib/offline";
import { farmDay, addDays, isLactating } from "@shared/care";
export default function BulkMilkPage() {
  const { user } = useAuth();
  const [date, setDate] = useState(farmDay()),
    [session, setSession] = useState("morning"),
    [values, setValues] = useState<Record<string, any>>({}),
    [message, setMessage] = useState("");
  const cattle = useQuery<any[]>({ queryKey: ["/api/cattle"] });
  const animals = (cattle.data || []).filter(isLactating);
  const { data: preferences } = useQuery<any>({
    queryKey: ["/api/operations/preferences"],
  });
  const change = (id: string, key: string, value: string) =>
    setValues((v) => ({ ...v, [id]: { ...v[id], [key]: value } }));
  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-5">
      <h1 className="text-2xl font-bold">Bulk milk entry</h1>
      <OfflineStatus user={user} />
      <Panel
        title="One session, every milking animal"
        description="Pregnancy does not remove a lactating animal. Blank quantities remain missing. Review copied measurements before saving."
      >
        <div className="flex gap-4 flex-wrap">
          <InputField
            label="Date"
            type="date"
            value={date}
            onChange={(e: any) => setDate(e.target.value)}
          />
          <SelectField
            label="Session"
            options={[
              "morning",
              "evening",
              ...(preferences?.milkingSessions === 3 ? ["night"] : []),
            ]}
            value={session}
            onChange={(e: any) => setSession(e.target.value)}
          />
          <Button
            variant="outline"
            onClick={async () => {
              try {
                const entries = await (
                  await apiRequest("GET", "/api/milk")
                ).json();
                const copy: any = {};
                for (const a of animals) {
                  const prior = entries.find(
                    (m: any) =>
                      m.cattleId === a.id &&
                      m.date === addDays(date, -1) &&
                      m.session === session,
                  );
                  if (prior)
                    copy[a.id] = {
                      quantity: prior.quantity,
                      fat: prior.fat || "",
                      snf: prior.snf || "",
                    };
                }
                setValues(copy);
                setMessage(
                  "Previous measurements loaded. Review actual production before saving.",
                );
              } catch (e: any) {
                setMessage(e.message);
              }
            }}
          >
            Load yesterday for review
          </Button>
        </div>
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
        {cattle.error && <p role="alert">Unable to load animals.</p>}
        <EntryForm
          reset={false}
          label="Save reviewed session"
          onSave={async () => {
            const entries = animals
              .filter(
                (a) =>
                  values[a.id]?.quantity !== undefined &&
                  values[a.id]?.quantity !== "",
              )
              .map((a) => ({
                cattleId: a.id,
                date,
                session,
                quantity: Number(values[a.id].quantity),
                destination: values[a.id].destination || "bulk",
                fat: values[a.id].fat ? Number(values[a.id].fat) : undefined,
                snf: values[a.id].snf ? Number(values[a.id].snf) : undefined,
              }));
            const result = await saveOfflineOperation(user, "/milk-bulk", {
              entries,
            });
            if (!result.queued) setValues({});
            queryClient.invalidateQueries();
            return result;
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="py-3">Animal</th>
                  <th>Litres</th>
                  <th>Fat %</th>
                  <th>SNF %</th>
                  <th>Destination</th>
                </tr>
              </thead>
              <tbody>
                {animals.map((a) => (
                  <tr key={a.id} className="border-t">
                    <td className="py-3 pr-4">
                      {a.tagNumber} {a.name}
                      <p className="text-xs text-muted-foreground">
                        {a.reproductiveStatus}
                      </p>
                    </td>
                    {["quantity", "fat", "snf"].map((k) => (
                      <td key={k} className="p-1">
                        <input
                          aria-label={`${a.tagNumber} ${k}`}
                          type="number"
                          min="0"
                          step="0.01"
                          className={control}
                          value={values[a.id]?.[k] || ""}
                          onChange={(e) => change(a.id, k, e.target.value)}
                        />
                      </td>
                    ))}
                    <td>
                      <select
                        aria-label={`${a.tagNumber} destination`}
                        className={control}
                        value={values[a.id]?.destination || "bulk"}
                        onChange={(e) =>
                          change(a.id, "destination", e.target.value)
                        }
                      >
                        <option value="bulk">Bulk</option>
                        <option value="discarded">Discarded</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </EntryForm>
      </Panel>
    </div>
  );
}
