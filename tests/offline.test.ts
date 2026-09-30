import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import {
  queuedOperations,
  saveOfflineOperation,
  syncOfflineOperations,
  update,
} from "../client/src/lib/offline-store";
import {
  rememberSession,
  rememberedSession,
  cacheFarmData,
  cachedFarmData,
} from "../client/src/lib/offline-cache";

const events = new EventTarget();
Object.defineProperty(globalThis, "window", {
  value: events,
  configurable: true,
});
Object.defineProperty(globalThis, "navigator", {
  value: { onLine: false },
  configurable: true,
});
const session: Record<string, string> = {};
Object.defineProperty(globalThis, "sessionStorage", {
  value: {
    setItem: (k: string, v: string) => {
      session[k] = v;
    },
    getItem: (k: string) => session[k] ?? null,
    removeItem: (k: string) => {
      delete session[k];
    },
  },
  configurable: true,
});
const user = { id: "user-a", tenantId: "farm-a" };
const response = (body: any, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
beforeEach(async () => {
  for (const scope of ["user-a:farm-a", "user-a:farm-b"])
    for (const q of await queuedOperations(scope)) await update(q.id, true);
  Object.defineProperty(globalThis, "navigator", {
    value: { onLine: false },
    configurable: true,
  });
});

test("offline writes persist and remain isolated by farm", async () => {
  assert.deepEqual(
    await saveOfflineOperation(user, "/events", {
      notes: "Offline observation",
    }),
    { queued: true },
  );
  assert.equal((await queuedOperations("user-a:farm-a")).length, 1);
  assert.equal((await queuedOperations("user-a:farm-b")).length, 0);
});
test("lost responses replay the same idempotency key exactly once", async () => {
  Object.defineProperty(globalThis, "navigator", {
    value: { onLine: true },
    configurable: true,
  });
  let firstKey: string | undefined, replayed: string | undefined;
  globalThis.fetch = async (_url, init) => {
    firstKey = (init?.headers as any)["Idempotency-Key"];
    throw new TypeError("Network response lost");
  };
  await saveOfflineOperation(user, "/events", { notes: "Saved at server" });
  globalThis.fetch = async (url, init) => {
    if (url === "/api/auth/user") return response(user);
    replayed = (init?.headers as any)["Idempotency-Key"];
    return response({ id: "saved" });
  };
  await syncOfflineOperations(user);
  assert.equal(replayed, firstKey);
  assert.equal((await queuedOperations("user-a:farm-a")).length, 0);
});
test("wrong farm and revision conflicts preserve the queued entry for review", async () => {
  await saveOfflineOperation(user, "/tasks/task1/complete", { revision: 1 });
  globalThis.fetch = async () => response({ ...user, tenantId: "farm-b" });
  await assert.rejects(() => syncOfflineOperations(user), /Switch back/);
  globalThis.fetch = async (url) =>
    url === "/api/auth/user"
      ? response(user)
      : response({ error: "Task changed; review" }, 409);
  await assert.rejects(() => syncOfflineOperations(user), /Task changed/);
  const queue = await queuedOperations("user-a:farm-a");
  assert.equal(queue.length, 1);
  assert.match(queue[0].error!, /Task changed/);
});
test("offline cached views are scoped and financial endpoints are never cached", () => {
  rememberSession(user);
  cacheFarmData("/api/cattle", [{ tag: "A1" }]);
  cacheFarmData("/api/incomes", [{ amount: 100 }]);
  assert.deepEqual(cachedFarmData("/api/cattle"), [{ tag: "A1" }]);
  assert.equal(cachedFarmData("/api/incomes"), undefined);
  rememberSession({ ...user, tenantId: "farm-b" });
  assert.equal(cachedFarmData("/api/cattle"), undefined);
  rememberSession(null);
  assert.equal(rememberedSession(), null);
  assert.equal(cachedFarmData("/api/cattle"), undefined);
});
