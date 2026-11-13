import { isAndroid, FarmSync, nativeGet } from "./native";
const USER_KEY = "dairyflow-session-user";
const sessionStore = () => (isAndroid ? localStorage : sessionStorage);
export function rememberSession(user: any) {
  if (user) {
    sessionStore().setItem(USER_KEY, JSON.stringify(user));
    if (isAndroid)
      void FarmSync.put({ key: "session", value: JSON.stringify(user) });
  } else {
    sessionStore().removeItem(USER_KEY);
    if (isAndroid) void FarmSync.remove({ key: "session" });
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith("dairyflow-data:")) sessionStorage.removeItem(key);
  }
}
export function rememberedSession() {
  try {
    return JSON.parse(sessionStore().getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}
const keyFor = (url: string) => {
  const user = rememberedSession();
  return user?.tenantId
    ? `dairyflow-data:${user.id}:${user.tenantId}:${url}`
    : null;
};
const cacheable = (url: string) =>
  isAndroid
    ? /^\/api\//.test(url) &&
      !/auth|whatsapp|storage-config|billing|superadmin|attachments|\/admin|\/system|\/storage/.test(
        url,
      )
    : url === "/api/cattle" ||
      url === "/api/milk" ||
      /^\/api\/operations\/(work|groups|stock|protocols|diets|people|preferences)(\?|$)/.test(
        url,
      );
export async function cacheFarmData(url: string, data: any) {
  const key = keyFor(url);
  if (isAndroid && key && cacheable(url)) {
    const u = rememberedSession();
    try {
      await FarmSync.put({
        key: `cache:${u.id}:${u.tenantId}:${url}`,
        value: JSON.stringify({ savedAt: Date.now(), data }),
      });
    } catch {}
    return;
  }
  if (key && cacheable(url))
    try {
      sessionStorage.setItem(
        key,
        JSON.stringify({ savedAt: new Date().toISOString(), data }),
      );
    } catch {
      /* A full cache must not turn a successful request into an error. */
    }
}
export async function cachedFarmData(url: string) {
  const key = keyFor(url);
  if (!key || !cacheable(url)) return undefined;
  try {
    if (isAndroid) {
      const u = rememberedSession(),
        stored = JSON.parse(
          (await nativeGet(`cache:${u.id}:${u.tenantId}:${url}`)) || "null",
        )?.data;
      if (stored !== undefined) return stored;
      if (/^\/api\/cattle\/[^/]+$/.test(url))
        return JSON.parse(
          (await nativeGet(`cache:${u.id}:${u.tenantId}:/api/cattle`)) ||
            "null",
        )?.data?.find((c: any) => c.id === url.split("/").at(-1));
      return undefined;
    }
    return JSON.parse(sessionStorage.getItem(key) || "null")?.data;
  } catch {
    return undefined;
  }
}
