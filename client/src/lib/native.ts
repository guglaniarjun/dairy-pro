import { Capacitor, registerPlugin } from "@capacitor/core";
import { offlineSalesView } from "@shared/offline-sales";
import { farmDay } from "@shared/care";
export const isAndroid = Capacitor.getPlatform() === "android";
export let nativeConnected = true;
export const FarmSync = registerPlugin<any>("FarmSync");
export const mobileCacheAllowed = (url: string) =>
  url.startsWith("/api/") &&
  !/auth|whatsapp|storage-config|billing|superadmin|attachments|\/admin|\/system|\/storage/.test(
    url,
  );
export async function nativeGet(key: string): Promise<string | null> {
  return (await FarmSync.get({ key })).value;
}
export async function resolveMobileLocation() {
  if (!isAndroid) return;
  const user = JSON.parse(
    localStorage.getItem("dairyflow-session-user") || "null",
  );
  if (!user?.tenantId) return;
  const prefix = `map:${user.id}:${user.tenantId}:`;
  const { entries } = await FarmSync.list({ prefix });
  const url = new URL(location.href);
  let changed = false;
  for (const row of entries) {
    const old = row.key.slice(prefix.length);
    const path = url.pathname.split("/");
    if (path.includes(old)) {
      url.pathname = path
        .map((part) => (part === old ? row.value : part))
        .join("/");
      changed = true;
    }
    for (const [key, value] of url.searchParams)
      if (value === old) {
        url.searchParams.set(key, row.value);
        changed = true;
      }
  }
  if (changed) {
    history.replaceState(null, "", url.pathname + url.search);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
}
export async function initializeAndroid() {
  if (!isAndroid) return;
  let config = await FarmSync.configure({});
  if (!config.url) {
    const root = document.getElementById("root")!;
    root.innerHTML = `<main class="max-w-md mx-auto p-6 space-y-4"><h1 class="text-2xl font-bold">DairyFlow</h1><p>Connect this phone to your farm. Sign in online once to download your farm records; subsequent entries can be saved offline.</p><form class="space-y-4"><label class="block">Farm server address<input class="block border rounded p-3 w-full mt-2" type="url" placeholder="https://your-farm.example" required /></label><button class="bg-primary text-primary-foreground rounded p-3 w-full">Connect to farm</button><p role="alert" class="text-destructive"></p></form></main>`;
    root.querySelector("input")!.value = import.meta.env.VITE_FARM_SERVER || "";
    config = await new Promise((resolve) =>
      root.querySelector("form")!.addEventListener("submit", async (e) => {
        e.preventDefault();
        try {
          resolve(
            await FarmSync.configure({
              url: root.querySelector("input")!.value,
            }),
          );
        } catch (error: any) {
          root.querySelector("[role=alert]")!.textContent = error.message;
        }
      }),
    );
  }
  const session = await nativeGet("session");
  if (session) localStorage.setItem("dairyflow-session-user", session);
  const originalFetch = window.fetch.bind(window);
  const base64 = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(
      input instanceof Request
        ? input
        : new URL(String(input), location.origin),
      init,
    );
    const url = new URL(request.url);
    if (url.origin !== location.origin || !url.pathname.startsWith("/api/"))
      return originalFetch(input, init);
    const form =
      init?.body instanceof FormData
        ? await Promise.all(
            [...init.body.entries()].map(async ([name, value]) =>
              typeof value === "string"
                ? { name, value }
                : {
                    name,
                    value: await base64(value),
                    file: value.name,
                    type: value.type,
                  },
            ),
          )
        : null;
    let path = url.pathname + url.search;
    const session = JSON.parse(
      localStorage.getItem("dairyflow-session-user") || "null",
    );
    const draftMatch = /^\/api\/cattle\/(pending:([^/]+))(?:\/(.*))?$/.exec(
      path,
    );
    if (request.method === "GET" && session?.tenantId && draftMatch) {
      const scope = `${session.id}:${session.tenantId}`,
        mapped = await nativeGet(`map:${scope}:${draftMatch[1]}`);
      if (mapped) path = path.replace(draftMatch[1], mapped);
      else {
        const id = draftMatch[2].split(":")[0];
        const entry = JSON.parse(
          (await nativeGet(`outbox:${scope}:${id}`)) || "null",
        );
        if (entry && !entry.rejected) {
          const animal = entry.path.endsWith("/cattle-purchase")
            ? entry.data.animal
            : entry.data;
          const data = draftMatch[3]
            ? draftMatch[3] === "pl-summary"
              ? {}
              : []
            : {
                status: "active",
                ...animal,
                id: draftMatch[1],
                pendingSync: true,
              };
          return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "X-DairyFlow-Offline": "true",
            },
          });
        }
      }
    }
    const cacheKey =
      session?.tenantId && mobileCacheAllowed(path)
        ? `cache:${session.id}:${session.tenantId}:${path}`
        : null;
    let response: any;
    try {
      if (!nativeConnected) throw new Error("Offline");
      response = form
        ? await FarmSync.upload({ path, method: request.method, form })
        : await FarmSync.request({
            path,
            method: request.method,
            body: ["GET", "HEAD"].includes(request.method)
              ? undefined
              : await request.text(),
            headers: Object.fromEntries(request.headers.entries()),
          });
      if (response.status >= 500)
        throw new Error(
          "The farm server is unavailable. Saved records remain on this phone.",
        );
      if (
        request.method === "GET" &&
        cacheKey &&
        response.status === 200 &&
        !response.binary
      ) {
        try {
          await FarmSync.put({
            key: cacheKey,
            value: JSON.stringify({
              savedAt: Date.now(),
              data: JSON.parse(response.body),
            }),
          });
        } catch {}
      }
    } catch (error) {
      if (request.method === "GET" && cacheKey) {
        let saved = JSON.parse((await nativeGet(cacheKey)) || "null");
        if (url.pathname === "/api/sales") {
          const raw = JSON.parse(
            (await nativeGet(
              `cache:${session.id}:${session.tenantId}:/api/operations/mobile-sales`,
            )) || "null",
          );
          if (raw)
            saved = {
              ...raw,
              data: offlineSalesView(
                raw.data,
                url.searchParams.get("date") || farmDay(),
              ),
            };
          else if (saved)
            saved = { ...saved, data: { ...saved.data, offline: true } };
        }
        const match =
          /^\/api\/cattle\/([^/]+)(?:\/(milk-entries|health-events|milk|heats|inseminations|pregnancy-tests|calvings|vaccinations|health|costs))?$/.exec(
            path,
          );
        if (!saved && match) {
          const source = match[2]
            ? (
                {
                  "milk-entries": "/api/milk",
                  "health-events": "/api/health",
                  milk: "/api/milk",
                  health: "/api/health",
                  costs: "/api/cattle-costs",
                  vaccinations: "/api/vaccinations",
                } as any
              )[match[2]] || `/api/breeding/${match[2]}`
            : "/api/cattle";
          const all = JSON.parse(
            (await nativeGet(
              `cache:${session.id}:${session.tenantId}:${source}`,
            )) || "null",
          );
          if (all)
            saved = {
              ...all,
              data: match[2]
                ? all.data.filter((v: any) => v.cattleId === match[1])
                : all.data.find((v: any) => v.id === match[1]),
            };
        }
        if (saved?.data !== undefined)
          return new Response(JSON.stringify(saved.data), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "X-DairyFlow-Offline": "true",
            },
          });
      }
      throw error;
    }
    const body = response.binary
      ? Uint8Array.from(atob(response.body), (c) => c.charCodeAt(0))
      : response.body;
    return new Response(
      [204, 205, 304].includes(response.status) ? null : body,
      {
        status: response.status,
        headers: { "Content-Type": response.contentType },
      },
    );
  };
  const originalOpen = window.open.bind(window);
  window.open = ((url?: string | URL, ...args: any[]) => {
    const target = new URL(String(url || ""), location.origin);
    if (
      target.origin === location.origin &&
      target.pathname.startsWith("/api/")
    ) {
      void FarmSync.openDocument({
        path: target.pathname + target.search,
      }).catch((e: any) => window.alert(e.message));
      return null;
    }
    return originalOpen(url, ...args);
  }) as typeof window.open;
  document.addEventListener("click", (event) => {
    const anchor = (event.target as Element).closest("a");
    if (!anchor) return;
    const url = new URL(anchor.href, location.origin);
    if (url.origin === location.origin && url.pathname.startsWith("/api/")) {
      event.preventDefault();
      void FarmSync.openDocument({ path: url.pathname + url.search }).catch(
        (e: any) => window.alert(e.message),
      );
    } else if (url.protocol === "blob:" && anchor.download) {
      event.preventDefault();
      void originalFetch(anchor.href)
        .then((r) => r.blob())
        .then(async (b) =>
          FarmSync.saveDocument({ data: await base64(b), type: b.type }),
        )
        .catch((e: any) => window.alert(e.message));
    }
  });
  const { App } = await import("@capacitor/app");
  const { Network } = await import("@capacitor/network");
  nativeConnected = (await Network.getStatus()).connected;
  await Network.addListener("networkStatusChange", ({ connected }) => {
    nativeConnected = connected;
    window.dispatchEvent(new Event(connected ? "online" : "offline"));
  });
  const launchPath = async () => {
    const { path } = await FarmSync.launchPath();
    if (path) {
      history.pushState(null, "", path);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  };
  await launchPath();
  await App.addListener("appStateChange", ({ isActive }) => {
    if (isActive) {
      void launchPath();
      window.dispatchEvent(new Event("farm-resume"));
    }
  });
  await App.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack) history.back();
    else App.minimizeApp();
  });
}
