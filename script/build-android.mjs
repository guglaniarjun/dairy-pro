import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
const root = process.cwd();
const win = process.platform === "win32";
const env = { ...process.env };
const jdkBase = path.join(root, ".android-tools", "microsoft-jdk");
if (!env.JAVA_HOME && fs.existsSync(jdkBase))
  env.JAVA_HOME = path.join(
    jdkBase,
    fs
      .readdirSync(jdkBase)
      .find((n) => fs.statSync(path.join(jdkBase, n)).isDirectory()),
  );
if (!env.JAVA_HOME) throw Error("Set JAVA_HOME to JDK 21 or later");
const pathKey =
  Object.keys(env).find((key) => key.toLowerCase() === "path") || "PATH";
env[pathKey] =
  path.join(env.JAVA_HOME, "bin") + path.delimiter + (env[pathKey] || "");
env.ANDROID_HOME ||= path.join(root, ".android-tools", "sdk");
env.GRADLE_USER_HOME ||= path.join(root, ".android-tools", "gradle");
env.JAVA_TOOL_OPTIONS = [
  env.JAVA_TOOL_OPTIONS,
  "-Djava.net.preferIPv4Stack=true",
]
  .filter(Boolean)
  .join(" ");
fs.writeFileSync(
  "android/local.properties",
  `sdk.dir=${env.ANDROID_HOME.replaceAll("\\", "/")}\n`,
);
fs.mkdirSync(".android-signing", { recursive: true });
if (!fs.existsSync(".android-signing/dairyflow-release.p12")) {
  const password = crypto.randomBytes(32).toString("hex");
  execFileSync(
    path.join(env.JAVA_HOME, "bin", win ? "keytool.exe" : "keytool"),
    [
      "-genkeypair",
      "-keystore",
      ".android-signing/dairyflow-release.p12",
      "-storetype",
      "PKCS12",
      "-alias",
      "dairyflow",
      "-keyalg",
      "RSA",
      "-keysize",
      "3072",
      "-validity",
      "10000",
      "-dname",
      "CN=DairyFlow, OU=Mobile, O=DairyFlow, C=IN",
      "-storepass:env",
      "DAIRYFLOW_SIGN_PASSWORD",
      "-keypass:env",
      "DAIRYFLOW_SIGN_PASSWORD",
    ],
    { env: { ...env, DAIRYFLOW_SIGN_PASSWORD: password }, stdio: "pipe" },
  );
  fs.writeFileSync(
    ".android-signing/signing.properties",
    `password=${password}\n`,
    { mode: 0o600 },
  );
}
const run = (cmd, args, shell = false) =>
  execFileSync(cmd, args, { env, stdio: "inherit", shell });
run(process.execPath, [
  path.join(root, "node_modules", "tsx", "dist", "cli.mjs"),
  "script/build.ts",
]);
run(process.execPath, [
  path.join(root, "node_modules", "@capacitor", "cli", "bin", "capacitor"),
  "sync",
  "android",
]);
const portable = path.join(
  root,
  ".android-tools",
  "gradle-dist",
  "gradle-8.14.3",
  "bin",
  win ? "gradle.bat" : "gradle",
);
run(
  fs.existsSync(portable)
    ? portable
    : path.join(root, "android", win ? "gradlew.bat" : "gradlew"),
  ["-p", "android", "assembleRelease", "testDebugUnitTest", "--no-daemon"],
  win,
);
const source = "android/app/build/outputs/apk/release/app-release.apk";
if (!fs.existsSync(source)) throw Error("Signed release APK was not produced");
fs.mkdirSync("artifacts", { recursive: true });
fs.copyFileSync(source, "artifacts/DairyFlow.apk");
fs.writeFileSync(
  "artifacts/DairyFlow.apk.sha256",
  crypto.createHash("sha256").update(fs.readFileSync(source)).digest("hex") +
    "  DairyFlow.apk\n",
);
console.log("Signed APK: " + path.join(root, "artifacts", "DairyFlow.apk"));
