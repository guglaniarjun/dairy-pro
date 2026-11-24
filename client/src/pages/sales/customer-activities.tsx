import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { farmDay } from "@shared/care";
import {
  Panel,
  InputField,
  SelectField,
  Field,
  control,
} from "@/components/farm-forms";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useSalesWrite } from "./common";

export function CustomerActivities({
  customers,
  canManage,
  selectedCustomer = "",
}: {
  customers: any[];
  canManage: boolean;
  selectedCustomer?: string;
}) {
  const [history, setHistory] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [closing, setClosing] = useState<any>(null);
  const write = useSalesWrite({ onlineOnly: true });
  const url = `/api/sales/customer-activities?${new URLSearchParams({ ...(selectedCustomer ? { customerId: selectedCustomer } : {}), ...(history ? { history: "all" } : {}) })}`;
  const query = useQuery<any>({ queryKey: [url] });
  const date = query.data?.date || farmDay();
  return (
    <div id="customer-activities">
      <Panel
        title="Customer activities and payment reminders"
        description="Delivery changes, collections and follow-ups. Recording an activity does not change a delivery order or record a payment."
      >
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <label className="flex gap-2 items-center text-sm">
            <input
              type="checkbox"
              checked={history}
              onChange={(e) => setHistory(e.target.checked)}
            />
            Show all manual activities and closed history
          </label>
          {canManage && (
            <Button
              onClick={() =>
                setEditing({
                  customerId: selectedCustomer,
                  kind: "follow_up",
                  dueDate: date,
                  priority: "medium",
                  status: "pending",
                })
              }
            >
              Add customer activity
            </Button>
          )}
        </div>
        {write.message}
        {query.isLoading ? (
          <p>Loading customer activities…</p>
        ) : query.error ? (
          <p role="alert">{query.error.message}</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              As of {date} · Times: {query.data?.timezone || "farm timezone"}.
              Open activities through the next 30 days and all overdue items are
              included. Collection reminders are calculated from bills and
              receipts.
            </p>
            {!query.data?.activities.length && (
              <p>No customer activities or payment reminders in this window.</p>
            )}
            <div className="space-y-3">
              {query.data?.activities.map((a: any) => {
                const open = ["pending", "in_progress"].includes(a.status);
                const overdue = open && a.dueDate < date;
                return (
                  <article
                    key={a.id}
                    className={`rounded-lg border p-3 space-y-2 ${open && a.priority === "urgent" ? "border-red-600 bg-red-50/40 dark:bg-red-950/20" : ""}`}
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <div>
                        <p className="font-semibold">
                          {a.customerName} · {a.title}
                        </p>
                        <p className="text-sm capitalize">
                          {a.kind.replaceAll("_", " ")} ·{" "}
                          {a.status.replaceAll("_", " ")}
                          {a.source === "payment_due"
                            ? " · Calculated reminder (not a task)"
                            : " · Manual activity"}
                        </p>
                      </div>
                      <div className="text-sm">
                        <strong
                          className={
                            open && (overdue || a.priority === "urgent")
                              ? "text-red-700 dark:text-red-400"
                              : ""
                          }
                        >
                          {!open
                            ? "Original due · "
                            : overdue
                              ? "Overdue · "
                              : a.dueDate === date
                                ? "Due today · "
                                : "Due "}
                          {a.dueDate}
                          {a.dueTime ? ` ${a.dueTime}` : ""}
                        </strong>
                        <p className="capitalize">
                          {a.priority} priority · {a.assignedToName}
                        </p>
                      </div>
                    </div>
                    {a.instructions && (
                      <p className="text-sm whitespace-pre-wrap">
                        {a.instructions}
                      </p>
                    )}
                    {a.completionNotes && (
                      <p className="text-sm">Completion: {a.completionNotes}</p>
                    )}
                    {a.cancellationReason && (
                      <p className="text-sm">
                        Cancellation: {a.cancellationReason}
                      </p>
                    )}
                    {a.completedAt && (
                      <p className="text-xs text-muted-foreground">
                        Completed by {a.completedByName} ·{" "}
                        {new Date(a.completedAt).toLocaleString("en-IN", {
                          timeZone: query.data?.timezone,
                        })}
                      </p>
                    )}
                    {a.cancelledAt && (
                      <p className="text-xs text-muted-foreground">
                        Cancelled by {a.cancelledByName} ·{" "}
                        {new Date(a.cancelledAt).toLocaleString("en-IN", {
                          timeZone: query.data?.timezone,
                        })}
                      </p>
                    )}
                    {a.source === "payment_due" ? (
                      <a
                        className="text-primary text-sm underline"
                        href={`/sales?tab=payments&customer=${encodeURIComponent(a.customerId)}`}
                      >
                        Open payment collection
                      </a>
                    ) : (
                      canManage &&
                      open && (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditing(a)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            onClick={() =>
                              setClosing({ ...a, action: "complete" })
                            }
                          >
                            Mark completed
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setClosing({ ...a, action: "cancel" })
                            }
                          >
                            Cancel activity
                          </Button>
                        </div>
                      )
                    )}
                  </article>
                );
              })}
            </div>
          </>
        )}
      </Panel>
      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing?.id ? "Edit customer activity" : "Add customer activity"}
            </DialogTitle>
            <DialogDescription>
              Set clear instructions, a due date and the responsible person.
              This is a reminder, not an automatic delivery change.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <form
              key={editing.id || "new"}
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                const d = Object.fromEntries(new FormData(e.currentTarget));
                const result = await write.save(
                  `/api/sales/customer-activities${editing.id ? `/${editing.id}` : ""}`,
                  {
                    ...d,
                    ...(editing.id ? { revision: editing.revision } : {}),
                  },
                  editing.id ? "PATCH" : "POST",
                );
                if (result) setEditing(null);
              }}
            >
              <SelectField
                label="Customer"
                name="customerId"
                required
                defaultValue={editing.customerId}
                options={customers
                  .filter((c) => c.active || c.id === editing.customerId)
                  .map((c) => ({ value: c.id, label: c.name }))}
              />
              <div className="grid sm:grid-cols-2 gap-3">
                <SelectField
                  label="Activity"
                  name="kind"
                  required
                  defaultValue={editing.kind}
                  options={[
                    { value: "delivery_change", label: "Delivery change" },
                    { value: "collection", label: "Payment collection" },
                    { value: "follow_up", label: "Customer follow-up" },
                  ]}
                />
                <SelectField
                  label="Priority"
                  name="priority"
                  required
                  defaultValue={editing.priority}
                  options={["low", "medium", "high", "urgent"]}
                />
              </div>
              <InputField
                label="What needs to happen?"
                name="title"
                required
                maxLength={180}
                defaultValue={editing.title || ""}
              />
              <Field label="Instructions">
                <textarea
                  className={control}
                  name="instructions"
                  maxLength={2000}
                  rows={3}
                  defaultValue={editing.instructions || ""}
                />
              </Field>
              <div className="grid sm:grid-cols-2 gap-3">
                <InputField
                  label="Due date"
                  name="dueDate"
                  type="date"
                  required
                  defaultValue={editing.dueDate}
                />
                <InputField
                  label="Due time (farm time, optional)"
                  name="dueTime"
                  type="time"
                  defaultValue={editing.dueTime || ""}
                />
              </div>
              <SelectField
                label="Responsible person"
                name="assignedTo"
                defaultValue={editing.assignedTo || ""}
                options={[
                  { value: "", label: "Unassigned — manager to assign" },
                  ...(query.data?.people || []).map((p: any) => ({
                    value: p.id,
                    label: p.name,
                  })),
                ]}
              />
              <SelectField
                label="Status"
                name="status"
                required
                defaultValue={editing.status}
                options={[
                  { value: "pending", label: "Pending" },
                  { value: "in_progress", label: "In progress" },
                ]}
              />
              {write.message}
              <Button type="submit" disabled={write.busy}>
                {write.busy ? "Saving…" : "Save activity"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!closing}
        onOpenChange={(open) => {
          if (!open) setClosing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {closing?.action === "complete"
                ? "Complete customer activity"
                : "Cancel customer activity"}
            </DialogTitle>
            <DialogDescription>
              {closing?.title}. Completion does not record a receipt; record any
              payment separately.
            </DialogDescription>
          </DialogHeader>
          {closing && (
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                const d = Object.fromEntries(new FormData(e.currentTarget));
                if (
                  await write.save(
                    `/api/sales/customer-activities/${closing.id}/${closing.action}`,
                    { revision: closing.revision, notes: d.notes },
                  )
                )
                  setClosing(null);
              }}
            >
              <Field
                label={
                  closing.action === "complete"
                    ? "What was done?"
                    : "Why is this cancelled?"
                }
              >
                <textarea
                  className={control}
                  name="notes"
                  rows={3}
                  required
                  maxLength={2000}
                />
              </Field>
              {write.message}
              <Button disabled={write.busy}>
                {write.busy
                  ? "Saving…"
                  : closing.action === "complete"
                    ? "Confirm completion"
                    : "Confirm cancellation"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
