const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { createServer } = require('http');

const PORT = 3001;
const API_PORT = 8787;
let mainWindow = null;
let server = null;
let api = null;

async function startNextServer() {
  const appDir = process.env.APP_ROOT || path.join(__dirname, '..', 'web');
  const next = require('next');

  const nextApp = next({ dev: false, dir: appDir, hostname: 'localhost', port: PORT });
  const handle = nextApp.getRequestHandler();

  await nextApp.prepare();

  server = createServer((req, res) => handle(req, res));

  return new Promise((resolve, reject) => {
    server.listen(PORT, 'localhost', resolve);
    server.on('error', reject);
  });
}

async function startApiServer() {
  const module = await import(path.join(__dirname, '..', 'server', 'dist', 'src', 'server.js'));
  api = module.createAppServer({
    port: API_PORT,
    host: '127.0.0.1',
    database: path.join(app.getPath('userData'), 'pi-agent.db'),
  });
  await api.listen();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 800, minWidth: 800, minHeight: 600,
    title: 'PiAgent',
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  mainWindow.loadURL(`http://localhost:${PORT}/chat`);
  mainWindow.on('closed', () => { mainWindow = null; });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(async () => {
  try {
    await startApiServer();
    await startNextServer();
    createWindow();
  } catch (e) {
    console.error('Failed to start:', e);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (server) server.close();
  if (api) void api.close();
  app.quit();
});

app.on('before-quit', () => {
  if (server) server.close();
  if (api) void api.close();
});
