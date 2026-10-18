'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('vagueWorkshop', Object.freeze({
  onVisibility: listener => {
    if (typeof listener !== 'function') return;
    const callback = (_event, open) => listener(open === true);
    ipcRenderer.on('workshop:visibility', callback);
    return () => ipcRenderer.removeListener('workshop:visibility', callback);
  },
  open: draft => ipcRenderer.invoke('workshop:open', draft),
  status: () => ipcRenderer.invoke('workshop:status'),
  saveDraft: text => ipcRenderer.invoke('workshop:draft', text),
  apply: text => ipcRenderer.invoke('workshop:apply', text),
  restore: () => ipcRenderer.invoke('workshop:restore'),
  undo: () => ipcRenderer.invoke('workshop:undo'),
  close: () => ipcRenderer.invoke('workshop:close')
}));

function subscribe(channel, listener) {
  if (typeof listener !== 'function') return;
  const handler = (_event, value) => listener(value);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}
contextBridge.exposeInMainWorld('vagueNetwork', Object.freeze({
  open: () => ipcRenderer.invoke('network:open'),
  bootstrap: () => ipcRenderer.invoke('network:bootstrap'),
  publish: (value, revision) => ipcRenderer.invoke('network:publish', value, revision),
  ready: revision => ipcRenderer.invoke('network:ready', revision),
  command: command => ipcRenderer.invoke('network:command', command),
  status: () => ipcRenderer.invoke('network:status'),
  host: options => ipcRenderer.invoke('network:host', options),
  join: options => ipcRenderer.invoke('network:join', options),
  lobbyReady: value => ipcRenderer.invoke('network:lobby-ready', value),
  startMatch: () => ipcRenderer.invoke('network:start-match'),
  returnLobby: () => ipcRenderer.invoke('network:return-lobby'),
  sabotage: (action,target) => ipcRenderer.invoke('network:sabotage',action,target),
  leave: () => ipcRenderer.invoke('network:leave'),
  close: () => ipcRenderer.invoke('network:close'),
  copyInvitation: () => ipcRenderer.invoke('network:copy'),
  onStatus: listener => subscribe('network:status', listener),
  onSnapshot: listener => subscribe('network:snapshot', listener),
  onCommand: listener => subscribe('network:command', listener)
}));
