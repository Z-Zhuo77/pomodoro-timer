const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  showNotification: (title, body) => {
    return ipcRenderer.invoke('show-notification', { title, body });
  },
});
