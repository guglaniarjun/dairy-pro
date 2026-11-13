export type Queued = {
  id: string;
  scope: string;
  tenantId: string;
  path: string;
  method: string;
  data: any;
  createdAt: string;
  error?: string;
  rejected?: boolean;
};
const openDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("dairyflow-outbox", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("requests", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
export async function update(value: Queued | string, remove = false) {
  if (isAndroid) {
    if (remove) {
      const { entries } = await FarmSync.list({ prefix: "outbox:" });
      for (const row of entries)
        if (JSON.parse(row.value).id === value)
          await FarmSync.remove({ key: row.key });
    } else {
      const q = value as Queued;
      await FarmSync.put({
        key: `outbox:${q.scope}:${q.id}`,
        value: JSON.stringify(q),
      });
    }
    window.dispatchEvent(new Event("farm-outbox"));
    return;
  }
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("requests", "readwrite");
      if (remove) tx.objectStore("requests").delete(value as string);
      else tx.objectStore("requests").put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
  window.dispatchEvent(new Event("farm-outbox"));
}
export async function queuedOperations(scope: string): Promise<Queued[]> {
  if (isAndroid)
    return (await FarmSync.list({ prefix: `outbox:${scope}:` })).entries
      .map((r: any) => JSON.parse(r.value) as Queued)
      .sort((a: Queued, b: Queued) => a.createdAt.localeCompare(b.createdAt));
  const db = await openDb();
  try {
    return await new Promise<Queued[]>((resolve, reject) => {
      const r = db.transaction("requests").objectStore("requests").getAll();
      r.onsuccess = () =>
        resolve(
          r.result
            .filter((q: Queued) => q.scope === scope)
            .sort((a: Queued, b: Queued) =>
              a.createdAt.localeCompare(b.createdAt),
            ),
        );
      r.onerror = () => reject(r.error);
    });
  } finally {
    db.close();
  }
}
export const scopeFor = (user: any) => `${user?.id}:${user?.tenantId}`;
async function send(q: Queued) {
  const response = await fetch(
    q.path.startsWith("/api/") ? q.path : `/api/operations${q.path}`,
    {
      method: q.method,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": q.id,
        "X-Farm-ID": q.tenantId,
      },
      body: JSON.stringify(q.data),
    },
  );
  const body = await response.json();
  if (!response.ok)
    throw Object.assign(new Error(body.error || "Request failed"), {
      rejected: response.status >= 400 && response.status < 500,
    });
  return body;
}
export async function saveOfflineOperation(
  user: any,
  path: string,
  data: any,
  method = "POST",
) {
  if (!user?.id || !user?.tenantId)
    throw new Error("Sign in to a farm before recording offline work");
  const queued: Queued = {
    id: crypto.randomUUID(),
    scope: scopeFor(user),
    tenantId: user.tenantId,
    path,
    data: data ?? {},
    method,
    createdAt: new Date().toISOString(),
  };
  // Write first: a lost response can safely be replayed with the same key.
  await update(queued);
  if (isAndroid) {
    if (!queued.path.startsWith("/api/")) {
      queued.path = `/api/operations${queued.path}`;
      await update(queued);
    }
    try {
      if (nativeConnected) await FarmSync.sync({ refresh: false });
    } catch {
      /* The durable native outbox retries on reconnect and in background. */
    }
    const result = await nativeGet(`result:${queued.scope}:${queued.id}`);
    if (result) return JSON.parse(JSON.parse(result).body || "{}");
    const pending = JSON.parse(
      (await nativeGet(`outbox:${queued.scope}:${queued.id}`)) || "null",
    );
    if (pending?.error?.startsWith("{")) {
      let message = pending.error;
      try {
        message = JSON.parse(message).error || message;
      } catch {}
      throw new Error(`Saved on this phone; needs review: ${message}`);
    }
    const draft: any = {
      ...data,
      id:
        method === "PATCH"
          ? queued.path.split("/").at(-1)
          : `pending:${queued.id}`,
      queued: true,
    };
    if (queued.path.endsWith("/cattle-purchase"))
      return {
        queued: true,
        cattle: { ...data.animal, id: `pending:${queued.id}:cattle` },
        transaction: {
          ...data.transaction,
          id: `pending:${queued.id}:transaction`,
        },
      };
    return draft;
  }
  if (!navigator.onLine) return { queued: true };
  try {
    const result = await send(queued);
    await update(queued.id, true);
    return result;
  } catch (e: any) {
    if (e instanceof TypeError) return { queued: true };
    await update({
      ...queued,
      error: e.message,
      rejected: e.rejected === true,
    });
    throw e;
  }
}

export async function syncOfflineOperations(user: any) {
  if (isAndroid) {
    const result = await FarmSync.sync();
    window.dispatchEvent(new Event("farm-outbox"));
    return result;
  }
  const r = await fetch("/api/auth/user", { credentials: "include" });
  if (!r.ok) throw new Error("Sign in again before syncing");
  const current = await r.json();
  if (scopeFor(current) !== scopeFor(user))
    throw new Error(
      "Switch back to the farm where these records were captured",
    );
  const failures: string[] = [];
  for (const q of await queuedOperations(scopeFor(user))) {
    if(q.rejected){failures.push(q.error||'A saved entry needs review');continue;}
    try {
      await send(q);
      await update(q.id, true);
    } catch (e: any) {
      await update({ ...q, error: e.message, rejected: e.rejected === true });
      failures.push(e.message);
    }
  }
  if (failures.length)
    throw new Error(
      `${failures.length} saved entries need review. ${failures[0]}`,
    );
}
import { isAndroid, FarmSync, nativeGet, nativeConnected } from "./native";

export function overlayPending(url: string, data: any, queue: Queued[]): any {
  if (url.startsWith("/api/sales") && data?.customers && data?.products) {
    return {
      ...data,
      customers: overlayPending("/api/sales/customers", data.customers, queue),
      products: overlayPending("/api/sales/products", data.products, queue),
    };
  }
  if (!Array.isArray(data)) return data;
  const result = data.map((row) => ({ ...row }));
  for (const q of queue) {
    if (q.rejected) continue;
    const path = q.path.startsWith("/api/")
      ? q.path
      : `/api/operations${q.path}`;
    if (path === url && q.method === "POST")
      result.push({ ...q.data, id: `pending:${q.id}`, pendingSync: true });
    if (path.startsWith(url + "/") && q.method === "PATCH") {
      const row = result.find((r) => r.id === path.slice(url.length + 1));
      if (row) Object.assign(row, q.data, { pendingSync: true });
    }
    if (url === "/api/cattle" && path === "/api/operations/cattle-purchase")
      result.push({
        ...q.data.animal,
        id: `pending:${q.id}:cattle`,
        status: "active",
        pendingSync: true,
      });
  }
  return result;
}
