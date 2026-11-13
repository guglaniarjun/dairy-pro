import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "in.dairyflow.farm",
  appName: "DairyFlow",
  webDir: "dist/public",
  server: { androidScheme: "https" },
  android: { allowMixedContent: false },
};
export default config;
