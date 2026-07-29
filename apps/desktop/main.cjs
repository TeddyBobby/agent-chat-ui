const { app, BrowserWindow, shell } = require("electron");
const { createReadStream, existsSync, statSync } = require("node:fs");
const { createServer } = require("node:http");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

let mainWindow = null;
let webServer = null;
let api = null;
let shuttingDown = false;

const hasSingleInstanceLock = app.requestSingleInstanceLock();

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function listen(server, host = "127.0.0.1") {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Unable to determine local server port"));
        return;
      }
      resolve(address.port);
    });
  });
}

async function startDevelopmentWebServer() {
  const appDir = process.env.APP_ROOT || path.join(__dirname, "..", "web");
  const next = require("next");
  const nextApp = next({ dev: false, dir: appDir, hostname: "127.0.0.1", port: 0 });
  const handle = nextApp.getRequestHandler();
  await nextApp.prepare();
  webServer = createServer((req, res) => handle(req, res));
  return listen(webServer);
}

function resolveStaticFile(webRoot, requestPath) {
  let pathname;
  try {
    pathname = decodeURIComponent(requestPath);
  } catch {
    return null;
  }

  const relativePath = pathname === "/"
    ? "index.html"
    : pathname.replace(/^\/+/, "");
  const candidates = [
    relativePath,
    path.join(relativePath, "index.html"),
    `${relativePath}.html`,
  ];

  for (const candidate of candidates) {
    const resolved = path.resolve(webRoot, candidate);
    if (
      resolved.startsWith(`${webRoot}${path.sep}`) &&
      existsSync(resolved) &&
      statSync(resolved).isFile()
    ) {
      return resolved;
    }
  }
  return null;
}

async function startPackagedWebServer() {
  const webRoot = path.resolve(__dirname, "generated", "web");
  webServer = createServer((req, res) => {
    const requestUrl = new URL(req.url || "/", "http://127.0.0.1");
    const file = resolveStaticFile(webRoot, requestUrl.pathname);
    if (!file) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    res.writeHead(200, {
      "Cache-Control": "no-cache",
      "Content-Type": MIME_TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Content-Security-Policy": [
        "default-src 'self'",
        "connect-src 'self' http://127.0.0.1:*",
        "img-src 'self' data: blob:",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "font-src 'self' data:",
      ].join("; "),
    });
    createReadStream(file).pipe(res);
  });
  return listen(webServer);
}

async function startApiServer(webOrigin) {
  const serverModule = app.isPackaged
    ? require(path.join(__dirname, "generated", "server.cjs"))
    : await import(pathToFileURL(path.join(__dirname, "..", "server", "dist", "src", "server.js")).href);

  process.env.PI_AGENT_WORKDIR ||= app.getPath("documents");
  api = serverModule.createAppServer({
    port: 0,
    host: "127.0.0.1",
    webOrigin,
    database: path.join(app.getPath("userData"), "pi-agent.db"),
  });
  return api.listen();
}

function createWindow(webOrigin, apiOrigin) {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "PiAgent",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  const pageUrl = `${webOrigin}/chat/?api=${encodeURIComponent(apiOrigin)}`;
  void mainWindow.loadURL(pageUrl);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (new URL(url).origin !== webOrigin) {
      event.preventDefault();
      openExternalUrl(url);
    }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalUrl(url);
    return { action: "deny" };
  });
}

function openExternalUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      void shell.openExternal(parsed.href);
    }
  } catch {
    // Ignore malformed or unsafe external URLs.
  }
}

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  if (webServer) {
    await new Promise((resolve) => webServer.close(resolve));
  }
  if (api) await api.close();
}

app.setName("PiAgent");

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    try {
      const webPort = app.isPackaged
        ? await startPackagedWebServer()
        : await startDevelopmentWebServer();
      const webOrigin = `http://127.0.0.1:${webPort}`;
      const apiAddress = await startApiServer(webOrigin);
      const apiOrigin = `http://127.0.0.1:${apiAddress.port}`;
      createWindow(webOrigin, apiOrigin);
    } catch (error) {
      console.error("Failed to start PiAgent:", error);
      await shutdown().catch(() => undefined);
      app.quit();
    }
  });
}

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", () => {
  void shutdown().catch((error) => {
    console.error("Failed to stop PiAgent cleanly:", error);
  });
});
