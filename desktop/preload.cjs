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
