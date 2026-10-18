'use strict';
const { app, BrowserWindow, Menu, protocol, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { PatchStore, FILES } = require('./patch-store.cjs');
protocol.registerSchemesAsPrivileged([
  { scheme: 'vague', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);
app.setName('Dernière Vague');
const GAME_URL = 'vague://game/index.html', WORKSHOP_URL = 'vague://workshop/index.html';
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'self'; frame-src 'none'";
let window, workshop, store, restarting = false;
const webPreferences = () => ({ nodeIntegration: false, contextIsolation: true, sandbox: true, preload: path.join(__dirname, 'preload.cjs') });
function secureWindow(view, allowedURL) {
  view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  view.webContents.on('will-navigate', (event, url) => { if (url !== allowedURL) event.preventDefault(); });
  view.webContents.on('will-redirect', (event, url) => { if (url !== allowedURL) event.preventDefault(); });
}
function openWorkshop() {
  if (!window || restarting) return;
  if (workshop && !workshop.isDestroyed()) { workshop.focus(); return; }
  window.webContents.send('workshop:visibility', true);
  workshop = new BrowserWindow({ title: 'Pokéball — Atelier du jeu', parent: window, modal: true, width: 870, height: 820, minWidth: 560, minHeight: 580, backgroundColor: '#101b27', show: false, webPreferences: webPreferences() });
  secureWindow(workshop, WORKSHOP_URL);
  workshop.setMenu(null);
  workshop.once('ready-to-show', () => workshop.show());
  workshop.on('closed', () => { workshop = null; if (window && !window.isDestroyed()) window.webContents.send('workshop:visibility', false); });
  workshop.loadURL(WORKSHOP_URL);
}
function requireWorkshop(event) {
  if (!workshop || event.sender !== workshop.webContents || event.senderFrame !== workshop.webContents.mainFrame || event.senderFrame.url !== WORKSHOP_URL) throw new Error('Cette action est réservée à l’atelier Pokéball.');
}
function restartGame() {
  restarting = true;
  // Give invoke() time to deliver its result before closing the workshop.
  setTimeout(() => {
    if (workshop && !workshop.isDestroyed()) workshop.close();
    if (window && !window.isDestroyed()) window.loadURL(GAME_URL);
    restarting = false;
  }, 150);
}
function result(action) { try { return { ok: true, ...action() }; } catch (error) { return { ok: false, error: error.message }; } }
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); } });
  app.whenReady().then(() => {
    app.setAppUserModelId('fr.dernierevague.game');
    const headless = process.platform === 'linux' && app.commandLine.getSwitchValue('ozone-platform') === 'headless';
    if (headless) Menu.setApplicationMenu(null);
    store = new PatchStore(path.join(__dirname, '..'), path.join(app.getPath('userData'), 'modifications'));
    protocol.handle('vague', request => {
      const url = new URL(request.url), file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405 });
      let content;
      try {
        if (url.host === 'game' && FILES.includes(file)) content = store.readGameFile(file);
        else if (url.host === 'workshop' && ['index.html', 'workshop.css', 'workshop.js'].includes(file)) content = fs.readFileSync(path.join(__dirname, file === 'index.html' ? 'workshop.html' : file), 'utf8');
        else return new Response('Not found', { status: 404 });
      } catch { return new Response('Fichier indisponible. Ouvrez l’atelier avec F8 pour revenir à l’origine.', { status: 500 }); }
      const mime = file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'text/html';
      return new Response(request.method === 'HEAD' ? null : content, { headers: { 'Content-Type': mime + '; charset=utf-8', 'Content-Security-Policy': CSP, 'Cache-Control': 'no-store' } });
    });
    ipcMain.handle('workshop:open', (event, draft) => {
      if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url !== GAME_URL) throw new Error('Origine du jeu invalide.');
      return result(() => { if (typeof draft === 'string' && draft && !store.hasDraft()) store.saveDraft(draft); openWorkshop(); });
    });
    ipcMain.handle('workshop:status', event => { requireWorkshop(event); return result(() => ({ ...store.status(), appVersion: app.getVersion() })); });
    ipcMain.handle('workshop:draft', (event, text) => { requireWorkshop(event); return result(() => { store.saveDraft(text); }); });
    for (const [channel, action] of [
      ['workshop:apply', text => store.apply(text)],
      ['workshop:restore', () => { store.restoreOriginal(); return { title: 'Version d’origine' }; }],
      ['workshop:undo', () => { store.undo(); return { title: store.status().title }; }]
    ]) ipcMain.handle(channel, (event, text) => {
      requireWorkshop(event);
      if (restarting) return { ok: false, error: 'Un redémarrage est déjà en cours.' };
      return result(() => { const changed = action(text); restartGame(); return changed; });
    });
    ipcMain.handle('workshop:close', event => { requireWorkshop(event); if (!restarting) workshop.close(); return { ok: true }; });
    window = new BrowserWindow({ title: 'Dernière Vague', width: 1440, height: 1000, minWidth: 840, minHeight: 640, backgroundColor: '#101b27', icon: path.join(__dirname, '..', 'build', 'icon.png'), show: false, webPreferences: webPreferences() });
    secureWindow(window, GAME_URL);
    if (!headless) Menu.setApplicationMenu(Menu.buildFromTemplate([{ label: 'Jeu', submenu: [
      { label: 'Atelier Pokéball…', accelerator: 'F8', click: openWorkshop },
      { label: 'Plein écran', accelerator: 'F11', click: () => window && window.setFullScreen(!window.isFullScreen()) },
      { type: 'separator' }, { role: 'quit', label: 'Quitter' }
    ] }]));
    window.once('ready-to-show', () => window.show());
    window.webContents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return;
      if (input.key === 'F8') { event.preventDefault(); openWorkshop(); }
      if (input.key === 'F11') { event.preventDefault(); window.setFullScreen(!window.isFullScreen()); }
      if (input.key === 'Escape' && window.isFullScreen()) window.setFullScreen(false);
    });
    window.on('closed', () => { window = null; });
    window.loadURL(GAME_URL);
  });
  app.on('window-all-closed', () => app.quit());
}
