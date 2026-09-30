const USER_KEY = "dairyflow-session-user";
export function rememberSession(user: any) {
  if (user) sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  else {
    sessionStorage.removeItem(USER_KEY);
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith("dairyflow-data:")) sessionStorage.removeItem(key);
  }
}
export function rememberedSession() {
  try {
    return JSON.parse(sessionStorage.getItem(USER_KEY) || "null");
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
  url === "/api/cattle" ||
  /^\/api\/operations\/(work|groups|stock|protocols|diets|people|preferences)(\?|$)/.test(
    url,
  );
export function cacheFarmData(url: string, data: any) {
  const key = keyFor(url);
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
export function cachedFarmData(url: string) {
  const key = keyFor(url);
  if (!key || !cacheable(url)) return undefined;
  try {
    return JSON.parse(sessionStorage.getItem(key) || "null")?.data;
  } catch {
    return undefined;
  }
}
