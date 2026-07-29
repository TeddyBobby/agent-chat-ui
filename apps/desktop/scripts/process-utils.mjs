import { spawnSync } from "node:child_process";

export function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with status ${result.status}`);
  }
}

export function restoreHostNativeModules(workspaceDir) {
  run(
    "pnpm",
    ["--filter", "@pi-agent/server", "rebuild", "better-sqlite3"],
    workspaceDir,
  );
}
