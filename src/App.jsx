import React, { useState, useEffect } from 'react';
import ConfigPanel from './components/ConfigPanel';
import ProgressMonitor from './components/ProgressMonitor';
import MasonryGallery from './components/MasonryGallery';
import Header from './components/layout/Header';
import { Bridge } from './utils/bridge';

export default function App() {
    const [isScanning, setIsScanning] = useState(false);
    const [folderPath, setFolderPath] = useState('');
    const [progressTotal, setProgressTotal] = useState(0);
    const [progressCurrent, setProgressCurrent] = useState(0);
    const [statusMessage, setStatusMessage] = useState('等待执行指令...');
    const [validPhotos, setValidPhotos] = useState([]);
    const [scanResults, setScanResults] = useState([]);
    const [isLogOpen, setIsLogOpen] = useState(false);

    // Theme Management
    const [theme, setTheme] = useState('dark');

    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

    React.useEffect(() => {
        if (!Bridge.isElectron()) return;

        const handleProcessUpdate = (data) => {
            if (data.type === 'start') {
                setProgressTotal(data.total);
                setProgressCurrent(0);
                setStatusMessage('开始分析...');
                setValidPhotos([]);
                setScanResults([]);
                setIsScanning(true);
            } else if (data.type === 'extracting') {
                setStatusMessage(`提取预览: ${data.fileName} (${data.current}/${data.total})`);
            } else if (data.type === 'progress') {
                setProgressCurrent(data.current);
                setScanResults(prev => [...prev, data]);
                setValidPhotos(prev => [...prev, data.fileName]);
                setStatusMessage(`分析: ${data.fileName}`);
            } else if (data.type === 'done') {
                setIsScanning(false);
                setStatusMessage('分析完成');
            } else if (data.type === 'cancelled') {
                setIsScanning(false);
                setStatusMessage('已取消');
            } else if (data.type === 'error') {
                setIsScanning(false);
                setStatusMessage(`错误: ${data.message}`);
            }
        };

        Bridge.onProcessUpdate(handleProcessUpdate);
        return () => Bridge.removeProcessUpdateListeners();
    }, []);

    // Auto-open logs when scanning starts
    useEffect(() => {
        if (isScanning) {
            setIsLogOpen(true);
        }
    }, [isScanning]);

    const handleStartScan = (path, threshold, formatFilter, aiConfig) => {
        setIsScanning(true);
        setFolderPath(path);
        setStatusMessage('正在初始化...');
        setValidPhotos([]);
        setScanResults([]);
        setProgressCurrent(0);

        // Call bridge
        Bridge.startProcess(path, threshold, formatFilter, aiConfig);

        // Mock progress for web dev mode
        if (!Bridge.isElectron()) {
            const total = 60;
            setProgressTotal(total);
            let current = 0;

            const interval = setInterval(() => {
                current += 1;
                if (current > total) {
                    clearInterval(interval);
                    setIsScanning(false);
                    setStatusMessage('分析完成');
                    return;
                }
                setProgressCurrent(current);
                const fileName = `photo_${current}.jpg`;
                const keep = Math.random() > 0.3;
                setStatusMessage(`分析: ${fileName}`);
                setValidPhotos(prev => [...prev, fileName]);
                const fakeFace1 = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2ZmNzc3NyIvPjwvc3ZnPg==';
                const fakeFace2 = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzc3NzdmZiIvPjwvc3ZnPg==';
                setScanResults(prev => [...prev, {
                    fileName,
                    keep,
                    reason: keep ? '清晰度达标' : '画面模糊',
                    tags: keep ? ['mock_tag'] : [],
                    faces: [
                        { image_b64: fakeFace1, laplacian: Math.random() * 200, ear: 0.31, is_blink: false },
                        { image_b64: fakeFace2, laplacian: Math.random() * 200, ear: 0.28, is_blink: false }
                    ]
                }]);
            }, 80);
        }
    };

    const handleCancel = () => {
        Bridge.cancelProcess();
        setIsScanning(false);
        setStatusMessage('已取消');
    };

    const isComplete = progressCurrent === progressTotal && progressTotal > 0 && !isScanning;

    return (
        <div className="h-screen bg-base text-text-primary flex flex-col overflow-hidden transition-colors duration-300">
            <Header theme={theme} toggleTheme={toggleTheme} />

            <main className="flex-1 flex overflow-hidden">
                {/* Left: Unified Sidebar */}
                <div className="w-[340px] flex flex-col border-r border-border bg-base z-20 shadow-2xl relative overflow-hidden">
                    {/* Top: Config Panel */}
                    <div className="flex-1 relative flex flex-col overflow-hidden p-5">
                        <ConfigPanel
                            onStart={handleStartScan}
                            disabled={isScanning}
                        />

                        {/* Cancel button during scan */}
                        {isScanning && (
                            <div className="mt-4 pt-4 border-t border-border flex-shrink-0">
                                <button
                                    className="w-full py-3 rounded-lg border border-status-reject/30 text-status-reject text-xs font-bold tracking-widest uppercase hover:bg-status-reject/10 transition-colors"
                                    onClick={handleCancel}
                                >
                                    HALT PROCESS
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Bottom: Progress Logs */}
                    <div className={`${isLogOpen ? 'h-[250px]' : 'h-[45px]'} border-t border-border bg-surface flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out`}>
                        <ProgressMonitor
                            isScanning={isScanning}
                            progressTotal={progressTotal}
                            progressCurrent={progressCurrent}
                            statusMessage={statusMessage}
                            isLogOpen={isLogOpen}
                            toggleLog={() => setIsLogOpen(!isLogOpen)}
                        />
                    </div>
                </div>

                {/* Right: Gallery */}
                <div className="flex-1 bg-base flex flex-col overflow-hidden relative">
                    <MasonryGallery
                        photos={validPhotos}
                        folderPath={folderPath}
                        isComplete={isComplete}
                        scanResults={scanResults}
                    />
                </div>
            </main>
        </div>
    );
}
