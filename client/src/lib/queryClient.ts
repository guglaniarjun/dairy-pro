import { cacheFarmData, cachedFarmData } from "./offline-cache";
import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { isAndroid } from './native';
import { saveOfflineOperation, queuedOperations, scopeFor, overlayPending } from './offline-store';
import { rememberedSession } from './offline-cache';

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    let message = text;
    try { const body = JSON.parse(text); message = body.error || body.message || text; } catch {}
    throw new Error(`${res.status}: ${message}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const user:any = queryClient.getQueryData(['/api/auth/user']);
  if (isAndroid && user?.tenantId && !['GET','HEAD'].includes(method.toUpperCase()) &&
      /^\/api\/(cattle(?:\/|$|-transactions)|milk(?:\/|$|-sales)|health(?:\/|$)|vaccinations(?:\/|$)|breeding\/|tasks(?:\/|$)|feed(?:\/|$)|sales(?:\/|$)|inventory(?:\/|$)|byproducts(?:\/|$)|expenses(?:\/|$)|incomes(?:\/|$)|operations\/)/.test(url)) {
    const result=await saveOfflineOperation(user,url,data,method);
    void queryClient.invalidateQueries();
    return new Response(JSON.stringify(result),{status:result.queued?202:200,headers:{'Content-Type':'application/json'}});
  }
  const res = await fetch(url, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...(!["GET", "HEAD"].includes(method)
        ? {
            "Idempotency-Key": crypto.randomUUID(),
            ...((queryClient.getQueryData(["/api/auth/user"]) as any)?.tenantId
              ? {
                  "X-Farm-ID": (
                    queryClient.getQueryData(["/api/auth/user"]) as any
                  ).tenantId,
                }
              : {}),
          }
        : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  if (!["GET", "HEAD"].includes(method.toUpperCase())) void queryClient.invalidateQueries();
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/");
    let res: Response;
    try {
      res = await fetch(url, { credentials: "include" });
    } catch (error) {
      const cached = await cachedFarmData(url);
      if (cached !== undefined) return isAndroid ? overlayPending(url,cached,await queuedOperations(scopeFor(rememberedSession()))) : cached;
      throw error;
    }

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    const data = await res.json();
    await cacheFarmData(url, data);
    return isAndroid ? overlayPending(url,data,await queuedOperations(scopeFor(rememberedSession()))) : data;
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true,
      staleTime: 30_000,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
