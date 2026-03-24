export const Bridge = {
    isElectron: () => !!window.electronAPI,

    selectFolder: async () => {
        if (window.electronAPI) return await window.electronAPI.selectFolder();
        return { success: true, path: "/mock/macOS/Photos/Event" };
    },

    scanFiles: async (path, formatFilter) => {
        if (window.electronAPI) return await window.electronAPI.scanFiles(path, formatFilter);
        // Mock response for web dev mode
        return {
            success: true,
            files: Array.from({ length: 150 }, (_, i) => `photo_${i + 1}.jpg`),
            total: 150,
            rawCount: 0,
            jpgCount: 150,
        };
    },

    startProcess: (path, threshold, formatFilter, aiConfig) => {
        if (window.electronAPI) {
            window.electronAPI.startProcess(path, threshold, formatFilter, aiConfig);
        } else {
            console.warn("Mock startProcess:", path, threshold, formatFilter, aiConfig);
        }
    },

    cancelProcess: () => {
        if (window.electronAPI) {
            window.electronAPI.cancelProcess();
        }
    },

    onProcessUpdate: (callback) => {
        if (window.electronAPI) {
            window.electronAPI.onProcessUpdate(callback);
        }
    },

    removeProcessUpdateListeners: () => {
        if (window.electronAPI) {
            window.electronAPI.removeProcessUpdateListeners();
        }
    },

    copyFiles: async (sourcePath, fileNames) => {
        if (window.electronAPI) return await window.electronAPI.copyFiles(sourcePath, fileNames);
        return { success: true, copied: fileNames.length };
    },

    checkXmpConflict: async (sourcePath, fileNames) => {
        if (window.electronAPI) return await window.electronAPI.checkXmpConflict(sourcePath, fileNames);
        return { conflict: false, conflictCount: 0 };
    },

    createXmp: async (sourcePath, results, overwrite) => {
        if (window.electronAPI) return await window.electronAPI.createXmp(sourcePath, results, overwrite);
        return { success: true, created: results.length };
    },
};
