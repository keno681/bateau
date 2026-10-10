'use strict';
const { app, BrowserWindow, Menu, protocol, net } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// A stable local origin keeps saves when a portable executable is moved or updated.
protocol.registerSchemesAsPrivileged([
  { scheme: 'vague', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);
app.setName('Dernière Vague');
const LOCAL_ORIGIN = 'vague://game';
const ALLOWED_FILES = new Set(['index.html', 'style.css', 'game.js']);
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'self'; frame-src 'none'";
let window;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (window) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); }
  });
  app.whenReady().then(() => {
    app.setAppUserModelId('fr.dernierevague.game');
    protocol.handle('vague', async (request) => {
      const url = new URL(request.url);
      const filename = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      if (url.host !== 'game' || !ALLOWED_FILES.has(filename)) {
        return new Response('Not found', {status: 404});
      }
      const response = await net.fetch(pathToFileURL(path.join(__dirname, '..', filename)).href);
      const headers = new Headers(response.headers);
      headers.set('Content-Security-Policy', CSP);
      return new Response(response.body, {status: response.status, headers});
    });
    Menu.setApplicationMenu(null);
    window = new BrowserWindow({
      title: 'Dernière Vague', width: 1440, height: 1000,
      minWidth: 840, minHeight: 640, backgroundColor: '#101b27',
      icon: path.join(__dirname, '..', 'build', 'icon.png'), show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true }
    });
    window.once('ready-to-show', () => window.show());
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', (event, url) => {
      if (!url.startsWith(LOCAL_ORIGIN + '/')) event.preventDefault();
    });
    window.webContents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return;
      if (input.key === 'F11') { event.preventDefault(); window.setFullScreen(!window.isFullScreen()); }
      if (input.key === 'Escape' && window.isFullScreen()) window.setFullScreen(false);
    });
    window.on('closed', () => { window = null; });
    window.loadURL(LOCAL_ORIGIN + '/index.html');
  });
  app.on('window-all-closed', () => app.quit());
}
