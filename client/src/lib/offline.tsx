import { useEffect, useState, useRef } from "react";
import {
  isAndroid,
  nativeGet,
  nativeConnected,
  resolveMobileLocation,
} from "./native";
import { cacheFarmData } from "./offline-cache";
import { SyncConflict } from "@/components/sync-conflict";
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
export function OfflineStatus({ user, automatic = !isAndroid }: any) {
  const syncLock = useRef(false);
  const [lastSync, setLastSync] = useState<string>("");
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
  useEffect(() => {
    if (!user?.tenantId || !automatic) return;
    const auto = () => {
      if (!document.hidden) void sync();
    };
    const interval = setInterval(auto, 60_000);
    window.addEventListener("online", auto);
    window.addEventListener("farm-resume", auto);
    document.addEventListener("visibilitychange", auto);
    auto();
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", auto);
      window.removeEventListener("farm-resume", auto);
      document.removeEventListener("visibilitychange", auto);
    };
  }, [user?.id, user?.tenantId]);
  const sync = async () => {
    if (isAndroid && !nativeConnected) {
      refresh();
      return;
    }
    if (syncLock.current) return;
    syncLock.current = true;
    setBusy(true);
    setMessage("");
    try {
      await syncOfflineOperations(user);
      await resolveMobileLocation();
      if (isAndroid) {
        const snapshotResponse = await fetch(
          "/api/operations/mobile-snapshot",
          { credentials: "include" },
        );
        if (
          snapshotResponse.ok &&
          !snapshotResponse.headers.get("X-DairyFlow-Offline")
        ) {
          const snapshot = await snapshotResponse.json();
          if (
            snapshot.userId !== user.id ||
            snapshot.tenantId !== user.tenantId
          )
            throw new Error(
              "Farm changed during sync; pending entries were preserved",
            );
          for (const [path, data] of Object.entries(snapshot.data))
            await cacheFarmData(path, data);
        }
        for (const path of [
          "/api/cattle",
          "/api/breeds",
          "/api/vaccines",
          "/api/milk",
          "/api/health",
          "/api/vaccinations",
          "/api/breeding/heats",
          "/api/breeding/inseminations",
          "/api/breeding/pregnancy-tests",
          "/api/breeding/calvings",
          "/api/tasks",
          "/api/alerts",
          "/api/dashboard/stats",
          "/api/operations/work",
          "/api/operations/groups",
          "/api/operations/stock",
          "/api/operations/protocols",
          "/api/operations/diets",
          "/api/operations/people",
          "/api/operations/preferences",
          "/api/operations/daily-report",
          "/api/operations/mobile-sales",
          "/api/sales",
        ]) {
          const response = await fetch(path, { credentials: "include" });
          if (response.ok) await cacheFarmData(path, await response.json());
        }
        const saved = await nativeGet(`last-sync:${scopeFor(user)}`);
        if (saved) setLastSync(new Date(Number(saved)).toLocaleString());
      } else setLastSync(new Date().toLocaleString());
      await queryClient.invalidateQueries();
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(false);
      syncLock.current = false;
      refresh();
    }
  };
  return (
    <div className="rounded-lg border bg-muted/30 p-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span>
          {(isAndroid ? nativeConnected : navigator.onLine)
            ? "Online"
            : "Offline • showing the last loaded farm data"}{" "}
          · {queue.length} device entry / entries awaiting sync
          {lastSync && (
            <span className="block text-xs">Last sync: {lastSync}</span>
          )}
        </span>
        {(queue.length > 0 || isAndroid) && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !(isAndroid ? nativeConnected : navigator.onLine)}
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
              {q.rejected &&
                !/retry key|different data/i.test(q.error || "") && (
                  <SyncConflict entry={q} />
                )}
              <p className="text-xs">
                {q.path === "/milk-bulk"
                  ? `${q.data.entries?.length || 0} milk entries · ${q.data.entries?.[0]?.date || ""} · ${q.data.entries?.[0]?.session || ""}`
                  : `Animal: ${q.data.cattleId || "Task"} · ${q.data.type || q.data.date || "completion"}`}
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
