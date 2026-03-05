const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    selectFolder: () => ipcRenderer.invoke('dialog:openDirectory'),
    startProcess: (path, blurThreshold) => ipcRenderer.send('process:start', path, blurThreshold),
    onProcessUpdate: (callback) => ipcRenderer.on('process:update', (event, data) => callback(data)),
    removeProcessUpdateListeners: () => ipcRenderer.removeAllListeners('process:update'),

    // V1.2 Additions
    copyFiles: (sourcePath, fileNames) => ipcRenderer.invoke('action:copyFiles', sourcePath, fileNames),
    checkXmpConflict: (sourcePath, fileNames) => ipcRenderer.invoke('action:checkXmpConflict', sourcePath, fileNames),
    createXmp: (sourcePath, results, overwrite) => ipcRenderer.invoke('action:createXmp', sourcePath, results, overwrite),
    trackAnalytics: (payload) => ipcRenderer.send('analytics:track', payload)
});
