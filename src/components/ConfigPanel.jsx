import React, { useState } from 'react';
import { Bridge } from '../utils/bridge';

export default function ConfigPanel({ onStart, disabled }) {
    const [path, setPath] = useState('');
    const [threshold, setThreshold] = useState(200);
    const [isSelecting, setIsSelecting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // Format filter
    const [rawEnabled, setRawEnabled] = useState(true);
    const [jpgEnabled, setJpgEnabled] = useState(true);

    // File scan results
    const [scanResult, setScanResult] = useState(null);
    const [isScanning, setIsScanning] = useState(false);

    const formatFilter = rawEnabled && jpgEnabled ? 'all' : rawEnabled ? 'raw' : jpgEnabled ? 'jpg' : null;

    const handleSelectPath = async () => {
        setIsSelecting(true);
        setErrorMsg('');
        setScanResult(null);

        try {
            const data = await Bridge.selectFolder();
            if (data.success && data.path) {
                setPath(data.path);
                // Auto-scan after folder selection
                await scanFolder(data.path);
            } else if (data.reason !== '用户取消了选择') {
                setErrorMsg(data.reason || 'FOLDER_SELECTION_FAILED');
            }
        } catch (err) {
            setErrorMsg('CONNECTION_LOST');
        } finally {
            setIsSelecting(false);
        }
    };

    const scanFolder = async (folderPath) => {
        setIsScanning(true);
        try {
            const result = await Bridge.scanFiles(folderPath, formatFilter);
            if (result.success) {
                setScanResult(result);
            } else {
                setErrorMsg(result.error || 'SCAN_FAILED');
            }
        } catch (err) {
            setErrorMsg('SCAN_ERROR');
        } finally {
            setIsScanning(false);
        }
    };

    // Re-scan when format filter changes
    const handleFormatChange = async (setter, value) => {
        setter(value);
        if (path) {
            // Recalculate — we need to wait for state update
            const newRaw = setter === setRawEnabled ? value : rawEnabled;
            const newJpg = setter === setJpgEnabled ? value : jpgEnabled;
            const newFilter = newRaw && newJpg ? 'all' : newRaw ? 'raw' : newJpg ? 'jpg' : null;
            if (newFilter) {
                setIsScanning(true);
                try {
                    const result = await Bridge.scanFiles(path, newFilter);
                    if (result.success) setScanResult(result);
                } catch (e) { }
                setIsScanning(false);
            }
        }
    };

    const handleStart = () => {
        if (!path) {
            setErrorMsg('ERR_NO_SOURCE_DIR');
            return;
        }
        if (!formatFilter) {
            setErrorMsg('ERR_NO_FORMAT_SELECTED');
            return;
        }
        setErrorMsg('');
        onStart(path, threshold, formatFilter);
    };

    const thresholdLabel =
        threshold < 300 ? 'LOOSE' :
            threshold < 500 ? 'STANDARD' : 'STRICT';

    return (
        <div className="flex flex-col h-full gap-8">
            {/* Section: Folder Selection */}
            <div>
                <label className="text-xs font-semibold text-text-secondary mb-2 block">
                    目标文件夹
                </label>

                <div
                    onClick={!disabled && !isSelecting ? handleSelectPath : undefined}
                    className={`border border-border bg-base p-3 cursor-pointer transition-all hover:border-accent group ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    {path ? (
                        <div className="flex items-center gap-3">
                            <svg className="w-4 h-4 text-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                            </svg>
                            <span className="text-sm font-medium text-text-primary truncate">{path.split('/').pop()}</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 text-text-muted group-hover:text-accent transition-colors">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                            </svg>
                            <span className="text-sm font-medium">
                                {isSelecting ? '加载中...' : '点击选择文件夹'}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Section: Format Filter */}
            <div>
                <label className="text-xs font-semibold text-text-secondary mb-2 block">
                    处理类型
                </label>
                <div className="checkbox-group flex gap-6">
                    <label className="font-mono text-xs tracking-wider">
                        <input
                            type="checkbox"
                            checked={rawEnabled}
                            onChange={(e) => handleFormatChange(setRawEnabled, e.target.checked)}
                            disabled={disabled || (!jpgEnabled && rawEnabled)}
                        />
                        RAW
                    </label>
                    <label className="font-mono text-xs tracking-wider">
                        <input
                            type="checkbox"
                            checked={jpgEnabled}
                            onChange={(e) => handleFormatChange(setJpgEnabled, e.target.checked)}
                            disabled={disabled || (!rawEnabled && jpgEnabled)}
                        />
                        JPG
                    </label>
                </div>
            </div>

            {/* Scan Summary Container - Technical Data Display */}
            <div className={`transition-all duration-300 overflow-hidden ${scanResult ? 'opacity-100 max-h-40' : 'opacity-0 max-h-0'}`}>
                {scanResult && (
                    <div className="bg-surface border border-border p-4 rounded-md shadow-soft-sm relative overflow-hidden">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-text-secondary">检索结果</span>
                            {isScanning && (
                                <span className="text-xs text-accent animate-pulse">扫描中...</span>
                            )}
                        </div>
                        <div className="text-2xl font-bold text-text-primary">
                            {scanResult.total} <span className="text-sm font-normal text-text-muted ml-1">个文件</span>
                        </div>
                        <div className="flex gap-4 mt-2 text-xs text-text-secondary">
                            {scanResult.rawCount > 0 && (
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-border"></span> RAW: {scanResult.rawCount}</span>
                            )}
                            {scanResult.jpgCount > 0 && (
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-border"></span> JPG: {scanResult.jpgCount}</span>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Section: Threshold / Sensitivity */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-text-secondary">
                        判定严格度
                    </label>
                    <span className="text-sm font-bold text-accent">{threshold}</span>
                </div>
                <div className="flex justify-between text-[10px] text-text-muted mb-1 px-1">
                    <span>宽松 (保留更多)</span>
                    <span>严格 (保留更少)</span>
                </div>

                <input
                    type="range"
                    min="0" max="800" step="10"
                    value={threshold}
                    onChange={(e) => setThreshold(parseInt(e.target.value))}
                    disabled={disabled}
                    className="w-full h-1 bg-surface rounded-none appearance-none cursor-pointer accent-accent mb-3 slider-thumb"
                />

                <div className="flex items-center justify-between">
                    <span className={`text-xs font-medium ${threshold < 300 ? 'text-status-keep' :
                        threshold < 500 ? 'text-accent' : 'text-status-reject'
                        }`}>
                        模糊容忍度: {
                            threshold < 300 ? '较高 (建议)' :
                                threshold < 500 ? '中等' : '极低'
                        }
                    </span>
                </div>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Error */}
            {errorMsg && (
                <div className="px-3 py-2 border border-status-reject bg-status-reject-dim text-status-reject font-mono text-[10px] tracking-widest uppercase animate-fade-in flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-status-reject rounded-none animate-pulse"></span>
                    {errorMsg}
                </div>
            )}

            {/* Action */}
            <button
                onClick={handleStart}
                disabled={disabled || !path || !formatFilter}
                className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2"
            >
                {disabled ? (
                    <>
                        <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        处理中...
                    </>
                ) : (
                    <>
                        开始分析
                    </>
                )}
            </button>
        </div>
    );
}
