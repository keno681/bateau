'use strict';
const { app, BrowserWindow, Menu, protocol, ipcMain, clipboard } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Room } = require('./room.cjs');
const { PatchStore, FILES } = require('./patch-store.cjs');
protocol.registerSchemesAsPrivileged([
  { scheme: 'vague', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);
app.setName('Dernière Vague');
const GAME_URL = 'vague://game/index.html', WORKSHOP_URL = 'vague://workshop/index.html', LOBBY_URL = 'vague://lobby/index.html';
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'self'; frame-src 'none'";
let window, workshop, lobby, store, room, restoreState, restarting = false;
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
function requireGame(event) {
  if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url !== GAME_URL) throw new Error('Origine du jeu invalide.');
}
function requireLobby(event) {
  if (!lobby || event.sender !== lobby.webContents || event.senderFrame !== lobby.webContents.mainFrame || event.senderFrame.url !== LOBBY_URL) throw new Error('Action réservée au salon multijoueur.');
}
function openLobby() {
  if (!window || restarting) return;
  if (lobby && !lobby.isDestroyed()) { lobby.focus(); return; }
  lobby = new BrowserWindow({ title: 'Équipage — Héberger ou rejoindre', parent: window, modal: true, width: 700, height: 790, minWidth: 540, minHeight: 580, show: false, backgroundColor: '#101b27', webPreferences: webPreferences() });
  secureWindow(lobby, LOBBY_URL); lobby.setMenu(null);
  lobby.once('ready-to-show', () => lobby.show()); lobby.on('closed', () => { lobby = null; }); lobby.loadURL(LOBBY_URL);
}
function restartGame() {
  restarting = true;
  // Give invoke() time to deliver its result before closing the workshop.
  setTimeout(() => {
    if (workshop && !workshop.isDestroyed()) workshop.close();
    if (lobby && !lobby.isDestroyed()) lobby.close();
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
    const identityFile=path.join(app.getPath('userData'),'network-player-id.txt');let playerId;
    try{playerId=fs.readFileSync(identityFile,'utf8').trim();}catch{}
    if(!/^[a-f0-9-]{36}$/.test(playerId||'')){playerId=crypto.randomUUID();fs.mkdirSync(app.getPath('userData'),{recursive:true});fs.writeFileSync(identityFile,playerId,{mode:0o600});}
    room = new Room({ id:playerId, version: app.getVersion(), validateFiles: files => {
      store.validateFiles(files);
      if((room?.match||room?.remoteMatch)&&!files['game.js'].includes('vague-saboteur-v1'))throw Error('Ce script retire le salon et les rôles secrets. Quittez le mode saboteur avant de l’appliquer.');
      if (!files['game.js'].includes('vague-network-v1') || !files['index.html'].includes('id="network"')) throw new Error('Les fichiers du jeu utilisent une ancienne version. Appliquez le script multijoueur 1.3.0 ou revenez à la version d’origine avant d’héberger.');
    } });
    room.on('status', status => {
      if (window && !window.isDestroyed()) window.webContents.setBackgroundThrottling(status.role !== 'host');
      for (const view of [window, lobby, workshop]) if (view && !view.isDestroyed()) view.webContents.send('network:status', status);
      if (status.role === 'host' && status.phase === 'running') restoreState = null;
    });
    room.on('snapshot', value => { if (window && !window.isDestroyed()) window.webContents.send('network:snapshot', value); });
    room.on('command', value => { if (window && !window.isDestroyed()) window.webContents.send('network:command', value); });
    room.on('reload', restartGame);
    room.on('rollback', () => { if (restoreState) { store.writeState(restoreState); restoreState = null; } });
    protocol.handle('vague', request => {
      const url = new URL(request.url), file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405 });
      let content;
      try {
        if (url.host === 'game' && FILES.includes(file)) content = room.files ? room.files[file] : store.readGameFile(file);
        else if (url.host === 'workshop' && ['index.html', 'workshop.css', 'workshop.js'].includes(file)) content = fs.readFileSync(path.join(__dirname, file === 'index.html' ? 'workshop.html' : file), 'utf8');
        else if (url.host === 'lobby' && ['index.html', 'lobby.css', 'lobby.js'].includes(file)) content = fs.readFileSync(path.join(__dirname, file === 'index.html' ? 'lobby.html' : file), 'utf8');
        else return new Response('Not found', { status: 404 });
      } catch { return new Response('Fichier indisponible. Ouvrez l’atelier avec F8 pour revenir à l’origine.', { status: 500 }); }
      const mime = file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'text/html';
      return new Response(request.method === 'HEAD' ? null : content, { headers: { 'Content-Type': mime + '; charset=utf-8', 'Content-Security-Policy': CSP, 'Cache-Control': 'no-store' } });
    });
    ipcMain.handle('workshop:open', (event, draft) => {
      if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url !== GAME_URL) throw new Error('Origine du jeu invalide.');
      return result(() => { if (typeof draft === 'string' && draft && !store.hasDraft()) store.saveDraft(draft); openWorkshop(); });
    });
    ipcMain.handle('workshop:status', event => { requireWorkshop(event); return result(() => ({ ...store.status(), appVersion: app.getVersion(), network: room.status() })); });
    ipcMain.handle('workshop:draft', (event, text) => { requireWorkshop(event); return result(() => { store.saveDraft(text); }); });
    for (const [channel, action] of [
      ['workshop:apply', text => store.apply(text)],
      ['workshop:restore', () => { store.restoreOriginal(); return { title: 'Version d’origine' }; }],
      ['workshop:undo', () => { store.undo(); return { title: store.status().title }; }]
    ]) ipcMain.handle(channel, (event, text) => {
      requireWorkshop(event);
      if (restarting) return { ok: false, error: 'Un redémarrage est déjà en cours.' };
      if (room.role === 'client') return { ok: false, error: 'Seul l’hôte peut modifier les fichiers pendant une partie multijoueur.' };
      return (async () => {
        const before = { ...store.state };
        try {
          const changed = action(text);
          if (room.role === 'host') {
            await room.prepareFiles(store.current().files);
            restoreState = before;
            setTimeout(() => { try { room.commitPrepared(); } catch { store.writeState(before); } }, 150);
          } else restartGame();
          return { ok: true, ...changed };
        } catch (error) { store.writeState(before); return { ok: false, error: error.message }; }
      })();
    });
    ipcMain.handle('workshop:close', event => { requireWorkshop(event); if (!restarting) workshop.close(); return { ok: true }; });
    ipcMain.handle('network:open', event => { requireGame(event); openLobby(); return { ok: true }; });
    ipcMain.handle('network:bootstrap', event => { requireGame(event); return room.bootstrap(); });
    ipcMain.handle('network:publish', (event, value, revision) => { requireGame(event); return result(() => { room.publish(value, revision); }); });
    ipcMain.handle('network:ready', (event, revision) => { requireGame(event); room.ready(revision); return { ok: true }; });
    ipcMain.handle('network:command', (event, command) => { requireGame(event); return { ok: room.command(command) }; });
    ipcMain.handle('network:status', event => { requireLobby(event); return { ok: true, ...room.status(true) }; });
    ipcMain.handle('network:host', async (event, options) => {
      requireLobby(event);
      try { return { ok: true, ...await room.host({ name: options?.name, port: options?.port, files: store.current().files, traitor: options?.traitor===true, goalDays: options?.goalDays, sleepDuration: 'day' }) }; }
      catch (error) { return { ok: false, error: error.message }; }
    });
    ipcMain.handle('network:join', async (event, options) => {
      requireLobby(event);
      try { return { ok: true, ...await room.join({ name: options?.name, invitation: options?.invitation }) }; }
      catch (error) { return { ok: false, error: error.message }; }
    });
    ipcMain.handle('network:lobby-ready', (event, value) => { requireLobby(event); return result(()=>{room.lobbyReady(value);}); });
    ipcMain.handle('network:start-match', async event => { requireLobby(event); try {await room.startMatch();return {ok:true};}catch(error){return {ok:false,error:error.message};} });
    ipcMain.handle('network:return-lobby', event => {requireLobby(event);return result(()=>{room.returnToLobby();});});
    ipcMain.handle('network:sabotage', (event, action, target) => {requireGame(event);return room.sabotage(action,target);});
    ipcMain.handle('network:leave', async event => { requireLobby(event); await room.leave(); restartGame(); return { ok: true }; });
    ipcMain.handle('network:copy', event => { requireLobby(event); if (room.role !== 'host') return { ok: false, error: 'Aucun code d’hôte disponible.' }; clipboard.writeText(room.invitation); return { ok: true }; });
    ipcMain.handle('network:close', event => { requireLobby(event); const view=lobby;setTimeout(()=>{if(!view.isDestroyed())view.close();},150);return { ok: true }; });
    window = new BrowserWindow({ title: 'Dernière Vague', width: 1440, height: 1000, minWidth: 840, minHeight: 640, backgroundColor: '#101b27', icon: path.join(__dirname, '..', 'build', 'icon.png'), show: false, webPreferences: webPreferences() });
    secureWindow(window, GAME_URL);
    if (!headless) Menu.setApplicationMenu(Menu.buildFromTemplate([{ label: 'Jeu', submenu: [
      { label: 'Multijoueur…', accelerator: 'F9', click: openLobby },
      { label: 'Atelier Pokéball…', accelerator: 'F8', click: openWorkshop },
      { label: 'Plein écran', accelerator: 'F11', click: () => window && window.setFullScreen(!window.isFullScreen()) },
      { type: 'separator' }, { role: 'quit', label: 'Quitter' }
    ] }]));
    window.once('ready-to-show', () => window.show());
    window.webContents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return;
      if (input.key === 'F9') { event.preventDefault(); openLobby(); }
      if (input.key === 'F8') { event.preventDefault(); openWorkshop(); }
      if (input.key === 'F11') { event.preventDefault(); window.setFullScreen(!window.isFullScreen()); }
      if (input.key === 'Escape' && window.isFullScreen()) window.setFullScreen(false);
    });
    window.on('closed', () => { window = null; });
    window.loadURL(GAME_URL);
  });
  app.on('before-quit', () => { if (room) room.leave().catch(() => {}); });
  app.on('window-all-closed', () => app.quit());
}
