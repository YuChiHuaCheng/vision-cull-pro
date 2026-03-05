const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    selectFolder: () => ipcRenderer.invoke('dialog:openDirectory'),

    scanFiles: (path, formatFilter) => ipcRenderer.invoke('scan:files', path, formatFilter),

    startProcess: (path, blurThreshold, formatFilter) =>
        ipcRenderer.send('process:start', path, blurThreshold, formatFilter),

    cancelProcess: () => ipcRenderer.send('process:cancel'),

    onProcessUpdate: (callback) =>
        ipcRenderer.on('process:update', (event, data) => callback(data)),

    removeProcessUpdateListeners: () =>
        ipcRenderer.removeAllListeners('process:update'),

    // Export actions
    copyFiles: (sourcePath, fileNames) =>
        ipcRenderer.invoke('action:copyFiles', sourcePath, fileNames),

    checkXmpConflict: (sourcePath, fileNames) =>
        ipcRenderer.invoke('action:checkXmpConflict', sourcePath, fileNames),

    createXmp: (sourcePath, results, overwrite) =>
        ipcRenderer.invoke('action:createXmp', sourcePath, results, overwrite),

    trackAnalytics: (payload) =>
        ipcRenderer.send('analytics:track', payload),
});
