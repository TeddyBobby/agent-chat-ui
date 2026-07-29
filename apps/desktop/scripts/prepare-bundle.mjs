import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { build } from "esbuild";

const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceDir = resolve(desktopDir, "../..");
const generatedDir = resolve(desktopDir, "generated");
const webOutput = resolve(workspaceDir, "apps/web/out");

await rm(generatedDir, { recursive: true, force: true });
await mkdir(generatedDir, { recursive: true });

const webBuild = spawnSync("pnpm", ["--filter", "@pi-agent/web", "build"], {
  cwd: workspaceDir,
  env: { ...process.env, PI_AGENT_DESKTOP_BUILD: "1" },
  stdio: "inherit",
});
if (webBuild.status !== 0) {
  throw new Error(`Desktop web build failed with status ${webBuild.status}`);
}

await cp(webOutput, resolve(generatedDir, "web"), { recursive: true });

await build({
  entryPoints: [resolve(workspaceDir, "apps/server/src/server.ts")],
  outfile: resolve(generatedDir, "server.cjs"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  sourcemap: false,
  external: ["better-sqlite3"],
});

console.log(`[desktop] prepared production bundle in ${generatedDir}`);
