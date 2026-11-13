import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import {
  queuedOperations,
  saveOfflineOperation,
  syncOfflineOperations,
  update,
  overlayPending,
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

test('offline customers created on this device remain selectable without applying rejected edits',()=>{
 const pending:any={id:'one',path:'/api/sales/customers',method:'POST',data:{name:'New customer'}};
 const rejected:any={id:'two',path:'/api/sales/customers/existing',method:'PATCH',data:{name:'Wrong'},rejected:true};
 const result=overlayPending('/api/sales?date=2026-11-14',{customers:[{id:'existing',name:'Existing'}],products:[]},[pending,rejected]);
 assert.equal(result.customers[0].name,'Existing');assert.equal(result.customers[1].id,'pending:one');
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
test("offline cached views are scoped and financial endpoints are never cached", async () => {
  rememberSession(user);
  await cacheFarmData("/api/cattle", [{ tag: "A1" }]);
  await cacheFarmData("/api/milk", [{ cattleId: "A1", quantity: "0" }]);
  await cacheFarmData("/api/incomes", [{ amount: 100 }]);
  assert.deepEqual(await cachedFarmData("/api/cattle"), [{ tag: "A1" }]);
  assert.deepEqual(await cachedFarmData("/api/milk"), [
    { cattleId: "A1", quantity: "0" },
  ]);
  assert.equal(await cachedFarmData("/api/incomes"), undefined);
  rememberSession({ ...user, tenantId: "farm-b" });
  assert.equal(await cachedFarmData("/api/cattle"), undefined);
  assert.equal(await cachedFarmData("/api/milk"), undefined);
  rememberSession(null);
  assert.equal(rememberedSession(), null);
  assert.equal(await cachedFarmData("/api/cattle"), undefined);
});


test("a rejected queue entry does not stop unrelated entries from syncing",async()=>{
 await saveOfflineOperation(user,'/events',{notes:'conflict'});
 await saveOfflineOperation(user,'/events',{notes:'independent'});
 globalThis.fetch=async(url,init)=> url==='/api/auth/user'?response(user): JSON.parse(String(init?.body)).notes==='conflict'?response({error:'Review record'},409):response({id:'accepted'});
 await assert.rejects(()=>syncOfflineOperations(user),/Review record/);
 const remaining=await queuedOperations('user-a:farm-a');assert.equal(remaining.length,1);assert.equal(remaining[0].rejected,true);
});
