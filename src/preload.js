const { contextBridge, ipcRenderer } = require('electron');

// Expose ipcRenderer to the renderer process
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    send: (channel, data) => {
      ipcRenderer.send(channel, data);
    },
    on: (channel, func) => {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  }
});

window.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fully loaded and parsed');
  
  // Handle IPC events
  ipcRenderer.on('show-settings', () => {
    const settingsPanel = document.getElementById('settings');
    if (settingsPanel) {
      settingsPanel.style.display = 'block';
    }
  });
});