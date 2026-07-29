import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { restoreHostNativeModules, run } from "./process-utils.mjs";

const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceDir = resolve(desktopDir, "../..");
const appPath = resolve(workspaceDir, "release", "mac-arm64", "PiAgent.app");

try {
  run("pnpm", ["bundle"], desktopDir);
  run("pnpm", ["exec", "electron-builder", "--mac", "--arm64", "--dir"], desktopDir);
} finally {
  restoreHostNativeModules(workspaceDir);
}

run("open", ["-n", appPath], workspaceDir);
