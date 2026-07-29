import { readFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { restoreHostNativeModules, run } from "./process-utils.mjs";

const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceDir = resolve(desktopDir, "../..");
const releaseDir = resolve(workspaceDir, "release");
const appOutputDir = resolve(releaseDir, "mac-arm64");
const packageJson = JSON.parse(
  await readFile(resolve(desktopDir, "package.json"), "utf8"),
);
const dmgPath = resolve(releaseDir, `PiAgent-${packageJson.version}-arm64.dmg`);

try {
  run("pnpm", ["bundle"], desktopDir);
  run("pnpm", ["exec", "electron-builder", "--mac", "--arm64", "--dir"], desktopDir);
  await rm(dmgPath, { force: true });
  run(
    "hdiutil",
    [
      "create",
      "-volname",
      "PiAgent",
      "-srcfolder",
      appOutputDir,
      "-ov",
      "-format",
      "UDZO",
      dmgPath,
    ],
    workspaceDir,
  );
} finally {
  // electron-builder rebuilds pnpm's shared native module in place. Restore the
  // host Node ABI so regular development and tests still work after packaging.
  restoreHostNativeModules(workspaceDir);
}

console.log(`[desktop] created ${dmgPath}`);
