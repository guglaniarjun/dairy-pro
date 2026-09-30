import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Panel,
  Field,
  InputField,
  SelectField,
  EntryForm,
  Supplies,
  AnimalChecks,
  Details,
  control,
} from "@/components/farm-forms";
import { farmDay, finishedTask } from "@shared/care";
import { saveOfflineOperation, OfflineStatus } from "@/lib/offline";

const opts = (rows: any[], label: string) =>
  rows.map((r) => ({ value: r.id, label: r[label] }));
const numSupplies = (rows: any[]) =>
  rows.map((r) => ({ ...r, quantity: Number(r.quantity) }));
export default function CarePage() {
  const { user } = useAuth();
  const permissions = (user as any)?.tenantPermissions || [];
  const can = (p: string) => permissions.includes(p);
  const [tab, setTab] = useState(
    new URLSearchParams(window.location.search).get("tab") || "work",
  );
  const cattle = useQuery<any[]>({
    queryKey: ["/api/cattle"],
    enabled: can("cattle.view"),
  });
  const work = useQuery<any>({
    queryKey: ["/api/operations/work"],
    enabled: can("tasks.view"),
  });
  const groups = useQuery<any[]>({
    queryKey: ["/api/operations/groups"],
    enabled: can("cattle.view"),
  });
  const stock = useQuery<any>({
    queryKey: ["/api/operations/stock"],
    enabled: can("inventory.view"),
  });
  const protocols = useQuery<any[]>({
    queryKey: ["/api/operations/protocols"],
    enabled: can("health.view"),
  });
  const diets = useQuery<any[]>({
    queryKey: ["/api/operations/diets"],
    enabled: can("feed.view"),
  });
  const people = useQuery<any[]>({
    queryKey: ["/api/operations/people"],
    enabled: can("tasks.view"),
  });
  const animals = (cattle.data || []).filter(
    (c) => c.status === "active" && !c.mergedIntoId,
  );
  const today = work.data?.today || farmDay();
  const save = async (
    path: string,
    data: any,
    method = "POST",
    offline = false,
  ) => {
    const result = offline
      ? await saveOfflineOperation(user, path, data, method)
      : await (await apiRequest(method, `/api/operations${path}`, data)).json();
    await queryClient.invalidateQueries();
    return result;
  };
  const props = {
    animals,
    today,
    groups: groups.data || [],
    items: stock.data?.forecast || [],
    people: people.data || [],
    save,
    can,
  };
  const tabs = [
    ["work", "Today's work", "tasks.view"],
    ["events", "Animal care", "cattle.view"],
    ["groups", "Groups & batches", "cattle.view"],
    ["protocols", "Care protocols", "health.view"],
    ["diets", "Diet plans", "feed.view"],
    ["stock", "Stock lots", "inventory.view"],
    ["quality", "Data review", "cattle.view"],
  ];
  const error = [cattle, work, groups, stock, protocols, diets, people].find(
    (q) => q.error,
  )?.error;
  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Care & Work</h1>
          <p className="text-muted-foreground">
            Every animal. Every action. {today}
          </p>
        </div>
        <Link href="/daily-report">
          <Button variant="outline">Complete daily report</Button>
        </Link>
      </div>
      <OfflineStatus user={user} />
      {error && (
        <p role="alert" className="text-destructive">
          Unable to load farm data: {error.message}{" "}
          <button onClick={() => queryClient.invalidateQueries()}>Retry</button>
        </p>
      )}
      <nav aria-label="Farm operations" className="flex gap-2 flex-wrap">
        {tabs
          .filter((t) => can(t[2]))
          .map((t) => (
            <Button
              key={t[0]}
              variant={tab === t[0] ? "default" : "outline"}
              onClick={() => {
                setTab(t[0]);
                history.replaceState(null, "", `/care?tab=${t[0]}`);
              }}
            >
              {t[1]}
            </Button>
          ))}
      </nav>
      {tab === "work" && (
        <Work {...props} work={work.data || { tasks: [], batches: [] }} />
      )}
      {tab === "events" && <Events {...props} />}{" "}
      {tab === "groups" && <Groups {...props} />}{" "}
      {tab === "protocols" && (
        <Protocols {...props} protocols={protocols.data || []} />
      )}{" "}
      {tab === "diets" && <Diets {...props} diets={diets.data || []} />}{" "}
      {tab === "stock" && (
        <Stock {...props} stock={stock.data || { lots: [], forecast: [] }} />
      )}
      {tab === "quality" && <Quality {...props} />}
    </div>
  );
}
function Work({ work, animals, today, people, save, can }: any) {
  const [filter, setFilter] = useState("due"),
    [selected, setSelected] = useState<any>(null),
    [checked, setChecked] = useState<string[]>([]),
    [staff, setStaff] = useState("");
  const counts = {
    overdue: work.tasks.filter(
      (t: any) => !finishedTask(t.status) && t.dueDate && t.dueDate < today,
    ).length,
    today: work.tasks.filter(
      (t: any) => !finishedTask(t.status) && t.dueDate === today,
    ).length,
    completed: work.tasks.filter((t: any) => t.status === "completed").length,
  };
  const tasks = work.tasks
    .filter(
      (t: any) =>
        (!staff || t.assignedTo === staff) &&
        (filter === "all" ||
          (filter === "due" &&
            !finishedTask(t.status) &&
            (!t.dueDate || t.dueDate <= today)) ||
          (filter === "upcoming" &&
            !finishedTask(t.status) &&
            t.dueDate > today) ||
          t.status === filter),
    )
    .sort((a: any, b: any) => (a.dueDate || "").localeCompare(b.dueDate || ""));
  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        {Object.entries(counts).map(([k, v]) => (
          <Panel key={k} title={k}>
            <p className="text-3xl font-semibold">{String(v)}</p>
          </Panel>
        ))}
      </div>
      <Panel
        title="Action list"
        description="Overdue actions stay here until completed, cancelled or excluded. Opening an alert does not complete the work."
      >
        <div className="flex flex-wrap gap-3">
          <select
            aria-label="Task status filter"
            className={control + " max-w-52"}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {[
              "due",
              "upcoming",
              "in_progress",
              "postponed",
              "blocked",
              "completed",
              "cancelled",
              "excluded",
              "all",
            ].map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
          <select
            aria-label="Assigned staff filter"
            className={control + " max-w-52"}
            value={staff}
            onChange={(e) => setStaff(e.target.value)}
          >
            <option value="">All staff</option>
            {people.map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.firstName} {p.lastName}
              </option>
            ))}
          </select>
          <Link href="/tasks/new">
            <Button variant="outline">Add task</Button>
          </Link>
        </div>
        <div className="divide-y">
          {!tasks.length && (
            <p className="py-6 text-muted-foreground">
              No actions match this view.
            </p>
          )}
          {tasks.map((t: any) => (
            <div key={t.id} className="py-4 flex justify-between gap-3">
              <div className="min-w-0">
                <div className="flex gap-2 flex-wrap">
                  <strong>{t.title}</strong>
                  <Badge
                    variant={
                      t.dueDate < today && !finishedTask(t.status)
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {t.status}
                  </Badge>
                </div>
                <p className="text-sm mt-1">
                  Tag{" "}
                  {animals.find((a: any) => a.id === t.cattleId)?.tagNumber ||
                    "—"}{" "}
                  · {t.dueDate || "No date"} ·{" "}
                  {people.find((p: any) => p.id === t.assignedTo)?.firstName ||
                    "Unassigned"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t.description} {t.reason}
                </p>
                {t.supplies?.length > 0 && (
                  <p className="text-xs mt-1">
                    {t.supplies.length} supply item(s) will be deducted on
                    completion
                  </p>
                )}
              </div>
              {can("tasks.manage") && !finishedTask(t.status) && (
                <Button variant="outline" onClick={() => setSelected(t)}>
                  Update
                </Button>
              )}
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Batch progress">
        {work.batches.map((b: any) => {
          const children = work.tasks.filter((t: any) => t.batchId === b.id);
          return (
            <details className="border rounded-lg p-3 mb-3" key={b.id}>
              <summary className="cursor-pointer font-medium">
                {b.title} ·{" "}
                {children.filter((t: any) => t.status === "completed").length}/
                {children.length} completed · {b.date}
              </summary>
              <div className="py-3 space-y-2">
                {children.map((t: any) => (
                  <label className="flex items-center gap-2 text-sm" key={t.id}>
                    <input
                      type="checkbox"
                      disabled={finishedTask(t.status)}
                      checked={checked.includes(t.id)}
                      onChange={(e) =>
                        setChecked(
                          e.target.checked
                            ? [...checked, t.id]
                            : checked.filter((id) => id !== t.id),
                        )
                      }
                    />
                    {animals.find((a: any) => a.id === t.cattleId)?.tagNumber ||
                      t.cattleId}{" "}
                    — {t.status} {t.reason && `(${t.reason})`}
                  </label>
                ))}
                {can("tasks.manage") && (
                  <EntryForm
                    label="Complete selected animals"
                    onSave={async (d) => {
                      const result = await save(`/batches/${b.id}/complete`, {
                        ...d,
                        taskIds: checked.filter((id) =>
                          children.some((t: any) => t.id === id),
                        ),
                        date: today,
                      });
                      setChecked([]);
                      return result;
                    }}
                  >
                    <InputField
                      label="Evidence for selected animals"
                      name="evidence"
                      required
                    />
                  </EntryForm>
                )}
              </div>
            </details>
          );
        })}
        {!work.batches.length && (
          <p className="text-sm text-muted-foreground">
            Create a batch in Groups & batches.
          </p>
        )}
      </Panel>
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.title}</DialogTitle>
          </DialogHeader>
          {selected && (
            <EntryForm
              reset={false}
              label="Update action"
              onSave={async (d) => {
                let result;
                if (d.status === "completed")
                  result = await save(
                    `/tasks/${selected.id}/complete`,
                    {
                      evidence: d.reason,
                      date: today,
                      revision: selected.revision,
                    },
                    "POST",
                    true,
                  );
                else
                  result = await save(
                    `/tasks/${selected.id}`,
                    {
                      status: d.status,
                      reason: d.reason,
                      revision: selected.revision,
                      ...(d.dueDate ? { dueDate: d.dueDate } : {}),
                      ...(d.assignedTo ? { assignedTo: d.assignedTo } : {}),
                    },
                    "PATCH",
                  );
                setSelected(null);
                return result;
              }}
            >
              <SelectField
                label="Action"
                name="status"
                required
                defaultValue="completed"
                options={[
                  "completed",
                  "in_progress",
                  "postponed",
                  "blocked",
                  "excluded",
                  "cancelled",
                ]}
              />
              <InputField label="Evidence or reason" name="reason" required />
              <InputField
                label="New due date (for postponement)"
                name="dueDate"
                type="date"
              />
              <SelectField
                label="Assign to"
                name="assignedTo"
                options={people.map((p: any) => ({
                  value: p.id,
                  label: `${p.firstName || ""} ${p.lastName || ""}`,
                }))}
              />
            </EntryForm>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
function Events({ animals, today, items, save, can }: any) {
  const [type, setType] = useState("observation"),
    [animal, setAnimal] = useState(""),
    [supplies, setSupplies] = useState<any[]>([]),
    [calves, setCalves] = useState([
      { tagNumber: "", gender: "female", weight: "" },
    ]);
  const history = useQuery<any[]>({
    queryKey: [`/api/operations/events?cattleId=${animal}`],
    enabled: !!animal,
  });
  const medical = ["treatment", "deworming", "vaccination"].includes(type);
  const birth = ["calving", "birth"].includes(type);
  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <Panel
        title="Record animal care"
        description="Actual observations and completed actions create a permanent animal history and the approved follow-ups."
      >
        <EntryForm
          reset={false}
          label="Record care"
          onSave={(d) => {
            const details: any = {};
            for (const k of [
              "expectedDate",
              "pen",
              "instructions",
              "weight",
              "lifeStage",
              "productionStatus",
              "reproductiveStatus",
              "healthStatus",
              "status",
            ])
              if (d[k]) details[k] = d[k];
            for (const k of [
              "repeatAfterDays",
              "milkWithdrawalDays",
              "meatWithdrawalDays",
              "quantity",
            ])
              if (d[k] !== undefined && d[k] !== "") details[k] = Number(d[k]);
            if (medical) details.supplies = numSupplies(supplies);
            if (birth) details.calves = calves;
            return save(
              "/events",
              {
                cattleId: animal,
                type,
                date: d.date,
                notes: d.notes || "",
                details,
              },
              "POST",
              true,
            );
          }}
        >
          <SelectField
            label="Animal"
            required
            value={animal}
            onChange={(e: any) => setAnimal(e.target.value)}
            options={opts(animals, "tagNumber")}
          />
          <SelectField
            label="Event"
            value={type}
            onChange={(e: any) => setType(e.target.value)}
            options={[
              "observation",
              "expected_calving",
              "dry_off",
              "calving",
              "pregnancy_loss",
              "treatment",
              "deworming",
              "vaccination",
              "weight",
              "weaning",
              "pen_move",
              "colostrum",
              "calf_feeding",
              "status_change",
            ]}
          />
          <InputField
            label="Date recorded / performed"
            type="date"
            name="date"
            required
            defaultValue={today}
          />
          {type === "expected_calving" && (
            <InputField
              label="Expected calving date"
              name="expectedDate"
              type="date"
              required
            />
          )}
          {type === "weight" && (
            <InputField
              label="Measured weight (kg)"
              name="weight"
              type="number"
              min="0.1"
              step="0.1"
              required
            />
          )}
          {type === "pen_move" && (
            <InputField label="New pen / location" name="pen" required />
          )}
          {birth && (
            <div className="space-y-3">
              <p className="text-sm">
                Select the mother above. Each live calf receives its own record.
              </p>
              {calves.map((c, i) => (
                <div key={i} className="grid grid-cols-3 gap-2">
                  <InputField
                    label={`Calf ${i + 1} tag`}
                    required
                    value={c.tagNumber}
                    onChange={(e: any) =>
                      setCalves(
                        calves.map((r, n) =>
                          n === i ? { ...r, tagNumber: e.target.value } : r,
                        ),
                      )
                    }
                  />
                  <SelectField
                    label="Sex"
                    options={["female", "male"]}
                    value={c.gender}
                    onChange={(e: any) =>
                      setCalves(
                        calves.map((r, n) =>
                          n === i ? { ...r, gender: e.target.value } : r,
                        ),
                      )
                    }
                  />
                  <InputField
                    label="Birth kg"
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={c.weight}
                    onChange={(e: any) =>
                      setCalves(
                        calves.map((r, n) =>
                          n === i ? { ...r, weight: e.target.value } : r,
                        ),
                      )
                    }
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setCalves([
                    ...calves,
                    { tagNumber: "", gender: "female", weight: "" },
                  ])
                }
              >
                Add another calf (twins)
              </Button>
            </div>
          )}
          {medical && (
            <>
              <InputField
                label="Approved prescription / instructions (dose, route, veterinarian)"
                name="instructions"
                required
              />
              <Supplies items={items} value={supplies} onChange={setSupplies} />
              <div className="grid sm:grid-cols-3 gap-2">
                <InputField
                  label="Repeat after days"
                  name="repeatAfterDays"
                  type="number"
                  min="1"
                />
                <InputField
                  label="Milk withdrawal days"
                  name="milkWithdrawalDays"
                  type="number"
                  min="0"
                />
                <InputField
                  label="Meat withdrawal days"
                  name="meatWithdrawalDays"
                  type="number"
                  min="0"
                />
              </div>
            </>
          )}
          {["calf_feeding", "colostrum"].includes(type) && (
            <InputField
              label="Amount supplied (litres; explain method in notes)"
              name="quantity"
              type="number"
              min="0"
              step="0.1"
            />
          )}
          {type === "status_change" && (
            <div className="grid sm:grid-cols-2 gap-3">
              <SelectField
                label="Life stage"
                name="lifeStage"
                options={["calf", "weaned_calf", "heifer", "adult"]}
              />
              <SelectField
                label="Production"
                name="productionStatus"
                options={["lactating", "dry", "not_lactating"]}
              />
              <SelectField
                label="Reproduction"
                name="reproductiveStatus"
                options={["unserved", "served", "pregnant", "lost"]}
              />
              <SelectField
                label="Health"
                name="healthStatus"
                options={["healthy", "under_care", "quarantine"]}
              />
              <SelectField
                label="Farm status"
                name="status"
                options={["active", "sold", "dead", "culled"]}
              />
            </div>
          )}
          <Field label="Observations / evidence">
            <textarea className={control} name="notes" rows={3} />
          </Field>
        </EntryForm>
      </Panel>
      <Panel title="Animal history">
        {!animal && (
          <p className="text-muted-foreground text-sm">
            Select an animal to view its care history.
          </p>
        )}
        {history.error && <p role="alert">Could not load history.</p>}
        {(history.data || [])
          .slice()
          .reverse()
          .map((e) => (
            <details className="border rounded p-3 mb-2" key={e.id}>
              <summary>
                {e.date} · {e.type.replaceAll("_", " ")}
              </summary>
              <div className="mt-3">
                <Details value={e.payload} />
                <p className="text-xs text-muted-foreground mt-2">
                  Entered {new Date(e.createdAt).toLocaleString()} ·{" "}
                  {e.recordedBy}
                </p>
              </div>
            </details>
          ))}
        {animal && !history.isLoading && !history.data?.length && (
          <p>No care events recorded yet.</p>
        )}
      </Panel>
    </div>
  );
}
function Groups({ animals, groups, today, items, people, save, can }: any) {
  const [kind, setKind] = useState("manual"),
    [selected, setSelected] = useState<string[]>([]),
    [batchAnimals, setBatchAnimals] = useState<string[]>([]),
    [supplies, setSupplies] = useState<any[]>([]);
  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <Panel title="Animal groups">
        <EntryForm
          onSave={(d) => {
            const criteria: any = {};
            for (const k of [
              "lifeStage",
              "productionStatus",
              "reproductiveStatus",
              "pen",
              "species",
            ])
              if (d[k]) criteria[k] = d[k];
            for (const k of ["minAgeDays", "maxAgeDays"])
              if (d[k]) criteria[k] = Number(d[k]);
            return save("/groups", {
              name: d.name,
              kind,
              cattleIds: selected,
              criteria,
            });
          }}
        >
          <InputField label="Group name" name="name" required />
          <SelectField
            label="Membership"
            options={["manual", "dynamic"]}
            value={kind}
            onChange={(e: any) => setKind(e.target.value)}
          />
          {kind === "manual" ? (
            <AnimalChecks
              animals={animals}
              value={selected}
              onChange={setSelected}
            />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="Life stage"
                name="lifeStage"
                options={["calf", "weaned_calf", "heifer", "adult"]}
              />
              <SelectField
                label="Production"
                name="productionStatus"
                options={["lactating", "dry", "not_lactating"]}
              />
              <SelectField
                label="Reproduction"
                name="reproductiveStatus"
                options={["unserved", "served", "pregnant", "lost"]}
              />
              <InputField label="Pen" name="pen" />
              <InputField
                label="Minimum age days"
                name="minAgeDays"
                type="number"
                min="0"
              />
              <InputField
                label="Maximum age days"
                name="maxAgeDays"
                type="number"
                min="0"
              />
            </div>
          )}
        </EntryForm>
        <div className="space-y-2">
          {groups.map((g: any) => (
            <details className="p-3 border rounded" key={g.id}>
              <summary>
                {g.name} · {g.members.length} animals · {g.kind}
              </summary>
              <p className="text-sm mt-2">
                {g.members.map((m: any) => m.tagNumber).join(", ") ||
                  "No eligible animals"}
              </p>
            </details>
          ))}
        </div>
      </Panel>
      <Panel
        title="Schedule batch work"
        description="Membership is captured when you create the batch. Each animal has its own completion, evidence and exclusion reason."
      >
        <EntryForm
          label="Create batch"
          onSave={(d) =>
            save("/batches", {
              ...d,
              groupId: d.groupId || undefined,
              cattleIds: batchAnimals,
              clinical: {
                ...(d.milkWithdrawalDays !== ""
                  ? { milkWithdrawalDays: Number(d.milkWithdrawalDays) }
                  : {}),
                ...(d.meatWithdrawalDays !== ""
                  ? { meatWithdrawalDays: Number(d.meatWithdrawalDays) }
                  : {}),
              },
              supplies: numSupplies(supplies),
              assignedTo: d.assignedTo || undefined,
            })
          }
        >
          <InputField
            label="Action e.g. calf deworming"
            name="title"
            required
          />
          <SelectField
            label="Saved group (or choose animals below)"
            name="groupId"
            options={opts(groups, "name")}
          />
          <AnimalChecks
            animals={animals}
            value={batchAnimals}
            onChange={setBatchAnimals}
          />
          <InputField
            label="Due date"
            name="date"
            type="date"
            defaultValue={today}
            required
          />
          <SelectField
            label="Work type"
            name="type"
            required
            defaultValue="health"
            options={["health", "breeding", "feeding", "other"]}
          />
          <SelectField
            label="Responsible person"
            name="assignedTo"
            options={people.map((p: any) => ({
              value: p.id,
              label: p.firstName || p.id,
            }))}
          />
          <InputField
            label="Approved instructions"
            name="instructions"
            required
          />
          <InputField
            label="Approved milk withdrawal days"
            name="milkWithdrawalDays"
            type="number"
            min="0"
            max="3650"
          />
          <InputField
            label="Approved meat withdrawal days"
            name="meatWithdrawalDays"
            type="number"
            min="0"
            max="3650"
          />
          <Supplies items={items} value={supplies} onChange={setSupplies} />
        </EntryForm>
      </Panel>
    </div>
  );
}
function Protocols({ protocols, items, save }: any) {
  const blank = {
    title: "",
    offsetDays: 0,
    repeatCount: 1,
    repeatEveryDays: "",
    milkWithdrawalDays: "",
    meatWithdrawalDays: "",
    instructions: "",
    type: "health",
    supplies: [],
    evidenceRequired: true,
  };
  const [steps, setSteps] = useState<any[]>([{ ...blank }]),
    [approval, setApproval] = useState<any>(null);
  const change = (i: number, k: string, v: any) =>
    setSteps(steps.map((s, n) => (n === i ? { ...s, [k]: v } : s)));
  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <Panel
        title="Create a care protocol"
        description="Examples: preparation 15 or 10 days before expected delivery; calf care by age; follow-up after treatment. Drafts generate no actions until approved."
      >
        <EntryForm
          label="Save draft"
          onSave={(d) =>
            save("/protocols", {
              name: d.name,
              familyId: d.familyId || undefined,
              trigger: d.trigger,
              eligibility: {
                ...(d.lifeStage ? { lifeStage: d.lifeStage } : {}),
                ...(d.species ? { species: d.species } : {}),
              },
              steps: steps.map((s) => ({
                ...s,
                offsetDays: Number(s.offsetDays),
                repeatCount: Number(s.repeatCount),
                repeatEveryDays: s.repeatEveryDays
                  ? Number(s.repeatEveryDays)
                  : undefined,
                milkWithdrawalDays:
                  s.milkWithdrawalDays !== ""
                    ? Number(s.milkWithdrawalDays)
                    : undefined,
                meatWithdrawalDays:
                  s.meatWithdrawalDays !== ""
                    ? Number(s.meatWithdrawalDays)
                    : undefined,
                supplies: numSupplies(s.supplies),
              })),
            })
          }
        >
          <InputField label="Protocol name" name="name" required />
          <SelectField
            label="New version of (optional)"
            name="familyId"
            options={protocols
              .filter(
                (p: any, i: number, a: any[]) =>
                  a.findIndex((x) => x.familyId === p.familyId) === i,
              )
              .map((p: any) => ({ value: p.familyId, label: p.name }))}
          />
          <SelectField
            label="Trigger / date anchor"
            name="trigger"
            required
            options={[
              "expected_calving",
              "birth",
              "calving",
              "dry_off",
              "insemination",
              "heat",
              "treatment",
              "weaning",
              "pregnancy_loss",
              "age",
            ]}
          />
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Eligible life stage (blank = all)"
              name="lifeStage"
              options={["calf", "weaned_calf", "heifer", "adult"]}
            />
            <SelectField
              label="Species (blank = all)"
              name="species"
              options={["cattle", "buffalo"]}
            />
          </div>
          {steps.map((s, i) => (
            <div className="border rounded-lg p-4 space-y-3" key={i}>
              <div className="flex justify-between">
                <strong>Step {i + 1}</strong>
                {steps.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setSteps(steps.filter((_, n) => n !== i))}
                  >
                    Remove
                  </button>
                )}
              </div>
              <InputField
                label="Action"
                value={s.title}
                required
                onChange={(e: any) => change(i, "title", e.target.value)}
              />
              <div className="grid grid-cols-3 gap-2">
                <InputField
                  label="Offset days (- = before)"
                  type="number"
                  required
                  value={s.offsetDays}
                  onChange={(e: any) => change(i, "offsetDays", e.target.value)}
                />
                <InputField
                  label="Occurrences"
                  type="number"
                  min="1"
                  max="100"
                  value={s.repeatCount}
                  onChange={(e: any) =>
                    change(i, "repeatCount", e.target.value)
                  }
                />
                <InputField
                  label="Repeat interval days"
                  type="number"
                  min="1"
                  value={s.repeatEveryDays}
                  onChange={(e: any) =>
                    change(i, "repeatEveryDays", e.target.value)
                  }
                />
              </div>
              <SelectField
                label="Action type"
                value={s.type}
                options={["health", "breeding", "feeding", "other"]}
                onChange={(e: any) => change(i, "type", e.target.value)}
              />
              <InputField
                label="Approved instructions / prescription"
                value={s.instructions}
                required
                onChange={(e: any) => change(i, "instructions", e.target.value)}
              />
              <Supplies
                items={items}
                value={s.supplies}
                onChange={(v: any) => change(i, "supplies", v)}
              />
              <div className="grid grid-cols-2 gap-2">
                <InputField
                  label="Milk withdrawal days"
                  type="number"
                  min="0"
                  value={s.milkWithdrawalDays}
                  onChange={(e: any) =>
                    change(i, "milkWithdrawalDays", e.target.value)
                  }
                />
                <InputField
                  label="Meat withdrawal days"
                  type="number"
                  min="0"
                  value={s.meatWithdrawalDays}
                  onChange={(e: any) =>
                    change(i, "meatWithdrawalDays", e.target.value)
                  }
                />
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() => setSteps([...steps, { ...blank }])}
          >
            Add step
          </Button>
        </EntryForm>
      </Panel>
      <Panel title="Protocol library">
        {protocols.map((p: any) => (
          <details className="p-4 border rounded-lg mb-3" key={p.id}>
            <summary>
              {p.name} · v{p.version} · {p.status}
            </summary>
            <p className="text-sm mt-2">
              Triggered by {p.trigger.replaceAll("_", " ")}
            </p>
            {p.steps.map((s: any, i: number) => (
              <p className="text-sm py-1" key={i}>
                {s.offsetDays} days: {s.title} · {s.repeatCount} occurrence(s)
              </p>
            ))}
            {p.approvalNote && (
              <p className="text-xs">Approved: {p.approvalNote}</p>
            )}
            {p.status === "draft" && (
              <Button className="mt-3" onClick={() => setApproval(p)}>
                Review & approve
              </Button>
            )}
          </details>
        ))}
        {!protocols.length && (
          <p className="text-sm text-muted-foreground">
            Add your farm's veterinarian-approved schedules.
          </p>
        )}
      </Panel>
      <Dialog open={!!approval} onOpenChange={() => setApproval(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve {approval?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            Approval activates this version for eligible animals. Existing
            completed work remains in the history.
          </p>
          <EntryForm
            label="Approve protocol"
            onSave={async (d) => {
              const result = await save(`/protocols/${approval.id}/approve`, d);
              setApproval(null);
              return result;
            }}
          >
            <InputField
              label="Reviewing professional and approval reference"
              name="note"
              required
            />
          </EntryForm>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function Diets({ diets, animals, groups, items, today, save }: any) {
  const [ingredients, setIngredients] = useState<any[]>([]);
  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <Panel
        title="Save an approved diet"
        description="An individual diet overrides a group diet. Quantities are per animal per feeding; use the reviewed ration from your nutritionist."
      >
        <EntryForm
          onSave={(d) =>
            save("/diets", {
              ...d,
              cattleId: d.cattleId || null,
              groupId: d.groupId || null,
              endDate: d.endDate || null,
              ingredients: numSupplies(ingredients),
            })
          }
        >
          <InputField label="Plan name" name="name" required />
          <SelectField
            label="Individual animal"
            name="cattleId"
            options={opts(animals, "tagNumber")}
          />
          <SelectField
            label="Or animal group"
            name="groupId"
            options={opts(groups, "name")}
          />
          <div className="grid grid-cols-2 gap-3">
            <InputField
              label="Start date"
              name="startDate"
              type="date"
              defaultValue={today}
              required
            />
            <InputField label="End date" name="endDate" type="date" />
          </div>
          <Supplies
            label="Ration ingredients per feeding"
            items={items}
            value={ingredients}
            onChange={setIngredients}
          />
          <InputField
            label="Nutritionist approval, transition and feeding instructions"
            name="instructions"
            required
          />
        </EntryForm>
      </Panel>
      <div className="space-y-5">
        <Panel
          title="Record actual feeding"
          description="The applicable diet is selected automatically. Exact lots and cost are recorded; refusals do not silently restore stock."
        >
          <EntryForm onSave={(d) => save("/feeding", d, "POST", true)}>
            <SelectField
              label="Animal"
              name="cattleId"
              options={opts(animals, "tagNumber")}
              required
            />
            <InputField
              label="Date"
              name="date"
              type="date"
              defaultValue={today}
              required
            />
            <InputField
              label="Ration factor (1 = prescribed quantities)"
              name="factor"
              type="number"
              min="0.01"
              step="0.01"
              defaultValue="1"
              required
            />
            <InputField
              label="Refused feed (kg, record details below)"
              name="refusal"
              type="number"
              min="0"
              step="0.1"
              defaultValue="0"
            />
            <InputField
              label="Notes / actual intake observations"
              name="notes"
            />
          </EntryForm>
        </Panel>
        <Panel title="Saved plans">
          {diets.map((d: any) => (
            <details key={d.id} className="border rounded p-3 mb-2">
              <summary>
                {d.name} · {d.startDate} → {d.endDate || "ongoing"}
              </summary>
              <p className="text-sm my-2">{d.instructions}</p>
              <Details
                value={d.ingredients.map((i: any) => ({
                  item: items.find((x: any) => x.id === i.itemId)?.name,
                  quantity: i.quantity,
                  unit: items.find((x: any) => x.id === i.itemId)?.unit,
                }))}
              />
              {!d.endDate && (
                <EntryForm
                  label="End this plan"
                  onSave={(v) => save(`/diets/${d.id}/end`, v)}
                >
                  <InputField
                    label="Last effective day"
                    name="date"
                    type="date"
                    required
                    defaultValue={today}
                  />
                </EntryForm>
              )}
            </details>
          ))}
        </Panel>
      </div>
    </div>
  );
}
function Stock({ stock, items, today, save }: any) {
  const [lot, setLot] = useState<any>(null);
  return (
    <>
      <div className="grid lg:grid-cols-2 gap-5">
        <Panel
          title="Receive medicines & consumables"
          description="Stock is kept in the item's base unit. For 2 bottles of 100 ml, enter 2 packs and 100 units per pack."
        >
          <Link
            href="/inventory/new"
            className="text-primary underline text-sm"
          >
            Create a stock item
          </Link>
          <EntryForm
            label="Receive lot"
            onSave={(d) =>
              save(d.existingBalance ? "/stock/reconcile" : "/stock/receive", d)
            }
          >
            <SelectField
              label="Item"
              name="itemId"
              options={opts(items, "name")}
              required
            />
            <label className="flex items-center gap-2 text-sm">
              <input name="existingBalance" type="checkbox" />
              Assign existing untracked stock to this lot (already in balance)
            </label>
            <InputField
              label="Supplier batch / receipt number"
              name="batchNumber"
              required
            />
            <div className="grid sm:grid-cols-2 gap-3">
              <InputField
                label="Number of packs"
                name="packs"
                type="number"
                min="0.001"
                step="0.001"
                required
              />
              <InputField
                label="Base units per pack"
                name="unitsPerPack"
                type="number"
                min="0.001"
                step="0.001"
                defaultValue="1"
                required
              />
              <InputField
                label="Cost per pack"
                name="packCost"
                type="number"
                min="0"
                step="0.01"
                required
              />
              <InputField
                label="Received date"
                name="receivedDate"
                type="date"
                defaultValue={today}
                required
              />
              <InputField label="Expiry date" name="expiryDate" type="date" />
              <InputField
                label="Usable days after opening"
                name="usableDays"
                type="number"
                min="1"
              />
            </div>
            <InputField label="Supplier" name="supplier" />
            <InputField label="Invoice number" name="invoice" />
            <InputField label="Storage location" name="location" />
          </EntryForm>
        </Panel>
        <Panel title="Stock readiness • next 14 days">
          {stock.forecast.map((i: any) => (
            <div key={i.id} className="py-3 border-b">
              <strong>{i.name}</strong>
              <p className="text-sm">
                Usable: {i.available} {i.unit} · Planned use: {i.required}
              </p>
              {(i.shortage > 0 || i.lowStock) && (
                <p className="text-sm text-destructive">
                  {i.shortage > 0
                    ? `Shortage: ${i.shortage} ${i.unit}`
                    : "Below minimum stock"}
                </p>
              )}
              {i.untracked > 0 && (
                <p className="text-sm text-amber-700">
                  {i.untracked} {i.unit} of legacy stock needs lot
                  reconciliation.
                </p>
              )}
              {i.expired.length > 0 && (
                <p className="text-sm text-destructive">
                  {i.expired.length} expired lot(s) blocked from use
                </p>
              )}
              {i.expiring.length > 0 && (
                <p className="text-sm text-amber-700">
                  {i.expiring.length} lot(s) expire within 14 days
                </p>
              )}
            </div>
          ))}
        </Panel>
      </div>
      <Panel
        title="Lot register"
        description="Usable lots are consumed in expiry order. Record opening, wastage, returns and physical-count adjustments here."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                {[
                  "Item / batch",
                  "Available",
                  "Expiry / opened",
                  "Location",
                  "",
                ].map((h, i) => (
                  <th className="py-3" key={i}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stock.lots.map((l: any) => (
                <tr key={l.id} className="border-b">
                  <td className="py-3">
                    {items.find((i: any) => i.id === l.itemId)?.name}
                    <br />
                    <span className="text-muted-foreground">
                      {l.batchNumber}
                    </span>
                  </td>
                  <td>
                    {l.quantity}{" "}
                    {items.find((i: any) => i.id === l.itemId)?.unit}
                  </td>
                  <td>
                    {l.expiryDate || "No expiry"}
                    <br />
                    {l.openedDate || "Unopened"}
                  </td>
                  <td>{l.location || "—"}</td>
                  <td>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLot(l)}
                    >
                      Movement
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Dialog open={!!lot} onOpenChange={() => setLot(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lot {lot?.batchNumber}</DialogTitle>
          </DialogHeader>
          <EntryForm
            onSave={async (d) => {
              const result = await save(`/stock/${lot.id}/move`, {
                ...d,
                quantity: d.quantity ? Number(d.quantity) : undefined,
              });
              setLot(null);
              return result;
            }}
          >
            <SelectField
              label="Movement"
              name="type"
              options={["open", "return", "waste", "adjust"]}
              required
            />
            <InputField
              label="Quantity (adjust = new physical balance; blank for opening)"
              name="quantity"
              type="number"
              min="0"
              step="0.001"
            />
            <InputField
              label="Date"
              name="date"
              type="date"
              defaultValue={today}
              required
            />
            <InputField label="Reason / evidence" name="reason" required />
          </EntryForm>
        </DialogContent>
      </Dialog>
    </>
  );
}
function Quality({ animals, save, can }: any) {
  const quality = useQuery<any>({ queryKey: ["/api/operations/quality"] });
  const [source, setSource] = useState(""),
    [target, setTarget] = useState(""),
    [preview, setPreview] = useState<any>(null),
    [error, setError] = useState("");
  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <Panel title="Records needing review">
        {quality.error && <p role="alert">Could not load data review.</p>}
        <h3 className="font-medium">Duplicate tags</h3>
        {quality.data?.duplicates.map((group: any[], i: number) => (
          <p className="text-sm" key={i}>
            {group.map((c) => `${c.tagNumber} (${c.name || c.id})`).join(" / ")}
          </p>
        ))}
        {!quality.data?.duplicates.length && (
          <p className="text-sm">No duplicate tags found.</p>
        )}
        <h3 className="font-medium">Production status needs confirmation</h3>
        {quality.data?.statusReview.map((a: any) => (
          <p key={a.id} className="text-sm">
            Tag {a.tagNumber}: {a.stage}. Set its independent statuses under
            Animal care.
          </p>
        ))}
        <p className="text-sm">
          Missing birth dates: {quality.data?.missingBirthDates.length || 0}
        </p>
      </Panel>
      {can("cattle.manage") && (
        <Panel
          title="Merge duplicate identities"
          description="Preview all affected records first. The source identity is retained as an alias. Overlapping milk sessions block a merge."
        >
          <SelectField
            label="Source duplicate"
            options={opts(animals, "tagNumber")}
            value={source}
            onChange={(e: any) => {
              setSource(e.target.value);
              setPreview(null);
            }}
          />
          <SelectField
            label="Keep this identity"
            options={opts(animals, "tagNumber")}
            value={target}
            onChange={(e: any) => {
              setTarget(e.target.value);
              setPreview(null);
            }}
          />
          <Button
            variant="outline"
            onClick={async () => {
              setError("");
              try {
                setPreview(
                  await (
                    await apiRequest(
                      "GET",
                      `/api/operations/merge-preview?source=${source}&target=${target}`,
                    )
                  ).json(),
                );
              } catch (e: any) {
                setError(e.message);
              }
            }}
          >
            Preview merge
          </Button>
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          {preview && (
            <>
              <Details
                value={{
                  source: preview.source.tagNumber,
                  keep: preview.target.tagNumber,
                  conflicts: preview.conflicts.length,
                  affected: preview.counts,
                }}
              />
              <EntryForm
                label="Merge reviewed identities"
                onSave={async (d) => {
                  const result = await save("/merge", {
                    sourceId: source,
                    targetId: target,
                    sourceRevision: preview.source.revision,
                    targetRevision: preview.target.revision,
                    reason: d.reason,
                  });
                  setPreview(null);
                  return result;
                }}
              >
                <InputField label="Reason for merge" name="reason" required />
              </EntryForm>
            </>
          )}
        </Panel>
      )}
    </div>
  );
}
