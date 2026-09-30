export type Queued = {
  id: string;
  scope: string;
  tenantId: string;
  path: string;
  method: string;
  data: any;
  createdAt: string;
  error?: string;
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
export async function queuedOperations(scope: string) {
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
  const response = await fetch(`/api/operations${q.path}`, {
    method: q.method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": q.id,
      "X-Farm-ID": q.tenantId,
    },
    body: JSON.stringify(q.data),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Request failed");
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
    data,
    method,
    createdAt: new Date().toISOString(),
  };
  // Write first: a lost response can safely be replayed with the same key.
  await update(queued);
  if (!navigator.onLine) return { queued: true };
  try {
    const result = await send(queued);
    await update(queued.id, true);
    return result;
  } catch (e: any) {
    if (e instanceof TypeError) return { queued: true };
    await update({ ...queued, error: e.message });
    throw e;
  }
}

export async function syncOfflineOperations(user: any) {
  const r = await fetch("/api/auth/user", { credentials: "include" });
  if (!r.ok) throw new Error("Sign in again before syncing");
  const current = await r.json();
  if (scopeFor(current) !== scopeFor(user))
    throw new Error(
      "Switch back to the farm where these records were captured",
    );
  for (const q of await queuedOperations(scopeFor(user))) {
    try {
      await send(q);
      await update(q.id, true);
    } catch (e: any) {
      await update({ ...q, error: e.message });
      throw e;
    }
  }
}
