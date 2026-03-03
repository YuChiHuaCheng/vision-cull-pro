import React, { useState } from 'react';
import ConfigPanel from './components/ConfigPanel';
import ProgressMonitor from './components/ProgressMonitor';
import ActionBar from './components/ActionBar';
import { Bridge } from './utils/bridge';

export default function App() {
    const [isScanning, setIsScanning] = useState(false);
    const [folderPath, setFolderPath] = useState('');
    const [progressTotal, setProgressTotal] = useState(0);
    const [progressCurrent, setProgressCurrent] = useState(0);
    const [statusMessage, setStatusMessage] = useState('');
    const [validPhotos, setValidPhotos] = useState([]);

    // Mock scan logic for UI testing since we don't have Electron bridge fully hooked up
    const handleStartScan = (path, threshold) => {
        setIsScanning(true);
        setFolderPath(path);
        setProgressTotal(150); // mock 150 photos
        setProgressCurrent(0);
        setStatusMessage(`Initializing scan at folder: ${path}...`);
        setValidPhotos([]);

        // Call bridge - in pure web dev mode this logs a warning
        Bridge.startProcess(path, threshold);

        // Mock progress interval setup if we are in pure web mode
        if (!Bridge.isElectron()) {
            window.onMockProgress = () => {
                let current = 0;
                const total = 150;
                const interval = setInterval(() => {
                    current += 5;
                    if (current > total) {
                        clearInterval(interval);
                        setIsScanning(false);
                        setStatusMessage('Analysis complete.');
                        return;
                    }
                    setProgressCurrent(current);
                    setStatusMessage(`Analyzing photo_${current}.jpg...`);
                    if (Math.random() > 0.3) {
                        setValidPhotos(prev => [...prev, `photo_${current}.jpg`]);
                    }
                }, 100);
            };
        }
    };

    const isComplete = progressCurrent === progressTotal && progressTotal > 0 && !isScanning;

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 p-8 font-sans selection:bg-teal-500/30 pb-32">
            <div className="max-w-4xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-cyan-500 tracking-tight">
                        VisionCull Pro
                    </h1>
                    <p className="text-slate-400 mt-2">AI-Powered Event Photo Assistant</p>
                </header>

                <ConfigPanel
                    onStart={handleStartScan}
                    disabled={isScanning}
                />

                <ProgressMonitor
                    isScanning={isScanning}
                    progressTotal={progressTotal}
                    progressCurrent={progressCurrent}
                    statusMessage={statusMessage}
                />

                {/* Gallery Placeholder - to be implemented in Task 4 */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg min-h-[300px] flex items-center justify-center text-slate-500">
                    Gallery UI Placeholder
                </div>

                <ActionBar
                    isComplete={isComplete}
                    folderPath={folderPath}
                    validPhotos={validPhotos}
                    onActionComplete={(msg) => alert(msg)}
                />

            </div>
        </div>
    );
}
