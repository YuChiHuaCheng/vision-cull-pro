import React, { useState } from 'react';
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

    const handleStartScan = (path, threshold, formatFilter) => {
        setIsScanning(true);
        setFolderPath(path);
        setStatusMessage('正在初始化...');
        setValidPhotos([]);
        setScanResults([]);
        setProgressCurrent(0);

        // Call bridge
        Bridge.startProcess(path, threshold, formatFilter);

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
                setScanResults(prev => [...prev, {
                    fileName,
                    keep,
                    reason: keep ? '清晰度达标' : '画面模糊',
                    tags: keep ? ['mock_tag'] : [],
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
        <div className="h-screen bg-base text-text-primary flex flex-col overflow-hidden">
            <Header />

            <main className="flex-1 flex overflow-hidden">
                {/* Left: Config Panel */}
                <div className="w-[300px] panel p-5">
                    <ConfigPanel
                        onStart={handleStartScan}
                        disabled={isScanning}
                    />

                    {/* Cancel button during scan */}
                    {isScanning && (
                        <div className="mt-8 border-t border-white/5 pt-4">
                            <button
                                className="btn-danger w-full text-xs"
                                onClick={handleCancel}
                            >
                                HALT PROCESS
                            </button>
                        </div>
                    )}
                </div>

                {/* Middle: Progress Logs */}
                <div className="w-[340px] panel flex flex-col">
                    <ProgressMonitor
                        isScanning={isScanning}
                        progressTotal={progressTotal}
                        progressCurrent={progressCurrent}
                        statusMessage={statusMessage}
                    />
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
