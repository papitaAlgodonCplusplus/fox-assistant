// Preload script
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
  
  // Handle context menu
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    
    const contextMenu = document.getElementById('context-menu');
    if (contextMenu) {
      contextMenu.style.display = 'block';
      contextMenu.style.left = `${e.clientX}px`;
      contextMenu.style.top = `${e.clientY}px`;
      
      // Close context menu when clicking elsewhere
      const closeContextMenu = () => {
        contextMenu.style.display = 'none';
        document.removeEventListener('click', closeContextMenu);
      };
      
      // Delay adding the click listener to prevent immediate closing
      setTimeout(() => {
        document.addEventListener('click', closeContextMenu);
      }, 100);
    }
  });
});