/**
 * PARALLAX — Native Desktop Application Entry Point (Windows & Linux)
 * Powered by Electron with hardware-accelerated WebGL2 raymarching.
 */

const { app, BrowserWindow, Menu } = require('electron');
const path = require('node:path');

// Ensure maximum WebGL2 & GPU performance across Windows and Linux graphics stacks
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-webgl');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');

let mainWindow = null;

function createObservatoryWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 620,
    title: 'PARALLAX — A Universe Beyond Observation',
    backgroundColor: '#05070b',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false
    }
  });

  // Load the zero-dependency standalone build offline
  const distHtml = path.join(__dirname, '..', 'dist', 'index.html');
  mainWindow.loadFile(distHtml);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuTemplate = [
    {
      label: 'Observatory',
      submenu: [
        { role: 'togglefullscreen', label: 'Toggle Fullscreen' },
        { role: 'reload', label: 'Reload Universe' },
        { type: 'separator' },
        { role: 'quit', label: 'Quit PARALLAX' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'toggleDevTools', label: 'Developer Telemetry Console' }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));
}

app.whenReady().then(() => {
  createObservatoryWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createObservatoryWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
