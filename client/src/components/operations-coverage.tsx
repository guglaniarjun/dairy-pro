import { useQuery } from "@tanstack/react-query";
import { EntryForm, InputField, SelectField, Panel } from "./farm-forms";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { farmDay } from "@shared/care";
import { useAuth } from "@/hooks/use-auth";
export function OperationsCoverage() {
  const { user } = useAuth();
  const canManage = ((user as any)?.tenantPermissions || []).includes(
    "tasks.manage",
  );
  const { data, error } = useQuery<any>({
    queryKey: ["/api/operations/coverage"],
  });
  const people = useQuery<any[]>({ queryKey: ["/api/operations/people"] });
  return (
    <Panel
      title="Farm operation coverage"
      description="Review every area and assign its approved schedule. These are review checklists; clinical dates, medicines and quantities come from your farm's approved plan."
    >
      {error && <p role="alert">Coverage could not be loaded.</p>}
      {data && (
        <p className="text-sm">
          {data.unassigned} open tasks need an owner ·{" "}
          {data.missingExpectedDates.length} pregnancies need an expected date ·{" "}
          {data.noVaccineHistory.length} active animals have no vaccination
          history.
        </p>
      )}
      {(data?.categories || []).map((c: any) => (
        <details className="border rounded p-3" key={c.key}>
          <summary className="cursor-pointer">
            {c.title} — {c.scheduled ? "Review scheduled" : "Schedule needed"}
          </summary>
          {canManage && (
            <EntryForm
              label="Schedule approved review"
              onSave={async (d) => {
                const r = await apiRequest("POST", "/api/operations/coverage", {
                  ...d,
                  key: c.key,
                  interval: Number(d.interval),
                });
                await queryClient.invalidateQueries();
                return r.json();
              }}
            >
              <InputField
                name="date"
                label="First review"
                type="date"
                defaultValue={farmDay()}
                required
              />
              <InputField
                name="interval"
                label="Repeat interval in days (from your farm plan)"
                type="number"
                min="1"
                max="3650"
                required
              />
              <SelectField
                name="assignedTo"
                label="Responsible person"
                options={(people.data || []).map((p) => ({
                  value: p.id,
                  label:
                    [p.firstName, p.lastName].filter(Boolean).join(" ") ||
                    p.name ||
                    p.email ||
                    p.id,
                }))}
                required
              />
              <InputField
                name="instructions"
                label="Checklist, approval reference and escalation instructions"
                required
              />
            </EntryForm>
          )}
        </details>
      ))}
    </Panel>
  );
}
