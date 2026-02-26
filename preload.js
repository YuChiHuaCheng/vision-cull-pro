const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    selectFolder: () => ipcRenderer.invoke('dialog:openDirectory'),
    startProcess: (path, blurThreshold) => ipcRenderer.send('process:start', path, blurThreshold),
    onProcessUpdate: (callback) => ipcRenderer.on('process:update', (event, data) => callback(data)),
    removeProcessUpdateListeners: () => ipcRenderer.removeAllListeners('process:update')
});
