const { app, BrowserWindow, shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const PORT = 3001;
let mainWindow = null;
let serverProcess = null;

function startNextServer() {
  return new Promise((resolve, reject) => {
    const cwd = process.env.APP_ROOT || path.join(__dirname, '..');
    serverProcess = spawn('node', ['node_modules/.bin/next', 'start', '-p', String(PORT)], {
      cwd,
      env: { ...process.env, NODE_ENV: 'production' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    serverProcess.stderr.on('data', (data) => {
      const msg = data.toString();
      // Next.js 16 启动成功标志
      if (msg.includes('Ready') || msg.includes('started server')) {
        resolve();
      }
    });

    serverProcess.on('error', reject);
    serverProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) reject(new Error(`Server exited with ${code}`));
    });

    // 兜底：2 秒后直接尝试连接
    setTimeout(() => {
      http.get(`http://localhost:${PORT}`, (res) => {
        resolve();
      }).on('error', () => {
        // 再等 2 秒
        setTimeout(() => resolve(), 2000);
      });
    }, 2000);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'PiAgent',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(`http://localhost:${PORT}/chat`);
  mainWindow.on('closed', () => { mainWindow = null; });

  // 外部链接用系统浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(async () => {
  try {
    await startNextServer();
    createWindow();
  } catch (e) {
    console.error('Failed to start:', e);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  app.quit();
});

app.on('before-quit', () => {
  if (serverProcess) serverProcess.kill();
});
