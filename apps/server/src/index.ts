import { createAppServer } from "./server.js";

const app = createAppServer();
const { port, host } = await app.listen();
console.log(`[PiAgent server] http://${host}:${port}`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
}
