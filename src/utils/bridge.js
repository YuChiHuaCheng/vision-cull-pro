export const Bridge = {
    isElectron: () => !!window.electronAPI,

    selectFolder: async () => {
        if (window.electronAPI) return await window.electronAPI.selectFolder();
        return { success: true, path: "/mock/macOS/Photos/Event" };
    },

    startProcess: (path, threshold) => {
        if (window.electronAPI) {
            window.electronAPI.startProcess(path, threshold);
        } else {
            console.warn("Mock startProcess triggered:", path, threshold);
            // Simulate fake progress for web mode testing
            if (window.onMockProgress) {
                window.onMockProgress();
            }
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
        return { success: true };
    },

    createXmp: async (sourcePath, results, overwrite) => {
        if (window.electronAPI) return await window.electronAPI.createXmp(sourcePath, results, overwrite);
        return { success: true };
    }
};
