import { useState } from "react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { update, type Queued } from "@/lib/offline-store";
import { control } from "./farm-forms";
export function SyncConflict({ entry }: { entry: Queued }) {
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState(entry.data),
    [current, setCurrent] = useState<any>(null),
    [error, setError] = useState("");
  const review = async () => {
    setOpen(true);
    setDraft({ ...entry.data });
    setCurrent(null);
    setError("");
    if (entry.method === "PATCH" || entry.path.includes("/tasks/"))
      try {
        const path = entry.path.startsWith("/api/")
          ? entry.path
          : "/api/operations" + entry.path;
        const task = /\/tasks\/([^/]+)/.exec(path);
        const response = await fetch(task ? "/api/operations/work" : path, {
          credentials: "include",
        });
        if (!response.ok)
          throw Error("Connect to load the current server record");
        const data = await response.json();
        setCurrent(task ? data.tasks.find((t: any) => t.id === task[1]) : data);
      } catch (e: any) {
        setError(e.message);
      }
  };
  const editable = Object.entries(draft).filter(
    ([key, value]) =>
      ![
        "cattleId",
        "tenantId",
        "id",
        "revision",
        "assignedTo",
        "itemId",
        "groupId",
        "inseminationId",
      ].includes(key) &&
      !key.endsWith("Id") &&
      ["string", "number"].includes(typeof value),
  );
  return (
    <>
      <Button variant="outline" size="sm" onClick={review}>
        Review saved entry
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85dvh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Review before retrying</DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            The entry is still saved on this phone. Compare it with current farm
            records and correct it before retrying.
          </p>
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          {editable.map(([key, value]) => (
            <label key={key} className="text-sm block">
              {key.replace(/([A-Z])/g, " $1")}
              {current && current[key] !== undefined && (
                <span className="block text-muted-foreground">
                  On VPS: {String(current[key])}
                </span>
              )}
              <input
                className={control}
                value={String(value)}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    [key]:
                      typeof value === "number"
                        ? Number(e.target.value)
                        : e.target.value,
                  })
                }
              />
            </label>
          ))}
          {current && (
            <p className="text-sm">
              Current status: {current.status || "—"} · revision{" "}
              {current.revision || "—"}. Saving below acknowledges this version.
            </p>
          )}
          <Button
            disabled={!!error}
            onClick={async () => {
              try {
                // Only an explicit rejection is editable: the server rolled it back and stored no receipt.
                // Keeping the identity also preserves any later offline entries that refer to this record.
                const corrected = {
                  ...entry,
                  data: {
                    ...draft,
                    ...(current?.revision != null
                      ? { revision: current.revision }
                      : {}),
                  },
                  error: undefined,
                  rejected: false,
                };
                await update(corrected);
                setOpen(false);
              } catch (e: any) {
                setError(e.message);
              }
            }}
          >
            Save reviewed entry for sync
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
