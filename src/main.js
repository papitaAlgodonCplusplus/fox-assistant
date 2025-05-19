const { app, BrowserWindow, ipcMain, Menu, Tray, screen } = require('electron');
const path = require('path');
const Store = require('electron-store');
require('dotenv').config();

// Create a store for settings
const store = new Store();

// Get the API key from store or env
const apiKey = store.get('openai_api_key') || process.env.OPENAI_API_KEY;
if (apiKey) {
  process.env.OPENAI_API_KEY = apiKey;
}

let mainWindow;
let tray = null;

function createWindow() {
  // Get primary display dimensions
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    width: 200,
    height: 700,
    title: '',
    transparent: true,
    frame: false,
    type: 'toolbar',
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: false
    }
  });

  // Position at bottom right by default
  mainWindow.setPosition(width - 200, height - 350);

  // Load the index.html of the app
  mainWindow.loadFile('index.html');

  // Create tray icon
  tray = new Tray(path.join(__dirname, 'assets/icons/fox-icon.png'));

  // Create context menu for tray
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Fox', click: () => mainWindow.show() },
    { label: 'Hide Fox', click: () => mainWindow.hide() },
    { type: 'separator' },
    { label: 'Settings', click: () => showSettings() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);

  // Set context menu
  tray.setContextMenu(contextMenu);

  // Show window when tray is clicked
  tray.on('click', () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });
}

function showSettings() {
  // Create settings window or show settings panel 
  if (mainWindow) {
    mainWindow.webContents.send('show-settings');
  }
}

// IPC handlers
function setupIpcHandlers() {
  ipcMain.on('window-move', (event, { mouseX, mouseY }) => {
    const { x, y } = screen.getCursorScreenPoint();
    mainWindow.setPosition(x - mouseX, y - mouseY);
  });

  // Save API key to store
  ipcMain.on('save-api-key', (event, apiKey) => {
    store.set('openai_api_key', apiKey);
    process.env.OPENAI_API_KEY = apiKey;
  });

  // Get API key from store
  ipcMain.handle('get-api-key', () => {
    return store.get('openai_api_key') || '';
  });
}

app.whenReady().then(() => {
  createWindow();
  setupIpcHandlers();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});