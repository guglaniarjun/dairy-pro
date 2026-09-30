import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { queryClient } from "./queryClient";
import {
  queuedOperations,
  scopeFor,
  update,
  syncOfflineOperations,
  type Queued,
} from "./offline-store";
export { saveOfflineOperation } from "./offline-store";
export function OfflineStatus({ user }: any) {
  const [queue, setQueue] = useState<Queued[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const refresh = () => {
    if (user?.tenantId)
      queuedOperations(scopeFor(user))
        .then(setQueue)
        .catch(() =>
          setMessage(
            "Device storage unavailable. Entries require an online connection.",
          ),
        );
  };
  useEffect(() => {
    refresh();
    window.addEventListener("farm-outbox", refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    return () => {
      window.removeEventListener("farm-outbox", refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
    };
  }, [user?.id, user?.tenantId]);
  const sync = async () => {
    setBusy(true);
    setMessage("");
    try {
      await syncOfflineOperations(user);
      await queryClient.invalidateQueries();
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(false);
      refresh();
    }
  };
  return (
    <div className="rounded-lg border bg-muted/30 p-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span>
          {navigator.onLine
            ? "Online"
            : "Offline • showing the last loaded farm data"}{" "}
          · {queue.length} device entry / entries awaiting sync
        </span>
        {queue.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !navigator.onLine}
            onClick={sync}
          >
            {busy ? "Syncing…" : "Sync pending entries"}
          </Button>
        )}
      </div>
      {message && (
        <p className="text-destructive mt-2" role="alert">
          {message}
        </p>
      )}
      {queue.length > 0 && (
        <details className="mt-2">
          <summary>Review queued entries</summary>
          {queue.map((q) => (
            <div className="border-t mt-2 py-2" key={q.id}>
              <p>
                {q.path} · {q.createdAt}
              </p>
              {q.error && <p className="text-destructive">{q.error}</p>}
              <p className="text-xs">
                Animal: {q.data.cattleId || "Task"} ·{" "}
                {q.data.type || q.data.date || "completion"}
              </p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (
                    window.confirm(
                      "Remove this device entry? It will not be sent. Check farm records first if a previous response was lost.",
                    )
                  )
                    update(q.id, true);
                }}
              >
                Discard queued entry
              </Button>
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
