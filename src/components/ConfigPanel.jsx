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
                setErrorMsg(data.reason || '选择文件夹失败');
            }
        } catch (err) {
            setErrorMsg('连接失败');
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
                setErrorMsg(result.error || '扫描失败');
            }
        } catch (err) {
            setErrorMsg('扫描出错');
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
            setErrorMsg('请先选择照片文件夹');
            return;
        }
        if (!formatFilter) {
            setErrorMsg('请至少选择一种文件格式');
            return;
        }
        setErrorMsg('');
        onStart(path, threshold, formatFilter);
    };

    const thresholdLabel =
        threshold < 300 ? '宽松' :
            threshold < 500 ? '标准' : '严格';

    const thresholdDesc =
        threshold < 300 ? '高容忍度，保留轻微动态模糊' :
            threshold < 500 ? '平衡模式，需要清晰边缘（推荐）' :
                '极端严格，只保留极致清晰的成片';

    return (
        <div className="flex flex-col h-full gap-6">
            {/* Section: Folder Selection */}
            <div>
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2 block">
                    照片文件夹
                </label>

                <div
                    onClick={!disabled && !isSelecting ? handleSelectPath : undefined}
                    className={`card p-3 cursor-pointer transition-colors hover:border-border-hover ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    {path ? (
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                            </svg>
                            <span className="text-sm text-text-primary truncate">{path.split('/').pop()}</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-text-muted">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                            </svg>
                            <span className="text-sm">
                                {isSelecting ? '正在打开...' : '点击选择文件夹'}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Section: Format Filter */}
            <div>
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2 block">
                    文件格式
                </label>
                <div className="checkbox-group flex gap-4">
                    <label>
                        <input
                            type="checkbox"
                            checked={rawEnabled}
                            onChange={(e) => handleFormatChange(setRawEnabled, e.target.checked)}
                            disabled={disabled || (!jpgEnabled && rawEnabled)}
                        />
                        RAW
                    </label>
                    <label>
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

            {/* Scan Summary Card */}
            {scanResult && (
                <div className="card p-3 animate-fade-in">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-text-muted">扫描结果</span>
                        {isScanning && (
                            <span className="text-[10px] text-accent">更新中...</span>
                        )}
                    </div>
                    <div className="text-lg font-semibold text-text-primary">
                        {scanResult.total} <span className="text-sm font-normal text-text-muted">张照片</span>
                    </div>
                    <div className="flex gap-3 mt-1 text-xs text-text-muted">
                        {scanResult.rawCount > 0 && (
                            <span>RAW: {scanResult.rawCount}</span>
                        )}
                        {scanResult.jpgCount > 0 && (
                            <span>JPG: {scanResult.jpgCount}</span>
                        )}
                    </div>
                </div>
            )}

            {/* Section: Threshold / Sensitivity */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
                        对焦容差
                    </label>
                    <span className="text-xs font-medium text-accent">{threshold}</span>
                </div>

                <input
                    type="range"
                    min="0" max="800" step="10"
                    value={threshold}
                    onChange={(e) => setThreshold(parseInt(e.target.value))}
                    disabled={disabled}
                    className="w-full h-1 bg-surface rounded-full appearance-none cursor-pointer accent-accent mb-2"
                />

                <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${threshold < 300 ? 'text-status-keep' :
                            threshold < 500 ? 'text-accent' : 'text-status-reject'
                        }`}>
                        {thresholdLabel}
                    </span>
                    <span className="text-[11px] text-text-muted">{thresholdDesc}</span>
                </div>
            </div>

            {/* Section: Engine Selection (Phase 1 — local only) */}
            <div>
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2 block">
                    处理引擎
                </label>
                <div className="card p-3 flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-status-keep" />
                    <div>
                        <span className="text-sm text-text-primary">本地引擎</span>
                        <p className="text-[11px] text-text-muted mt-0.5">对焦 · 闭眼 · 曝光检测</p>
                    </div>
                </div>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Error */}
            {errorMsg && (
                <div className="px-3 py-2 rounded-lg bg-status-reject-dim border border-status-reject/20 text-status-reject text-xs animate-fade-in">
                    {errorMsg}
                </div>
            )}

            {/* Action */}
            <button
                onClick={handleStart}
                disabled={disabled || !path || !formatFilter}
                className="btn-primary w-full py-3 text-sm font-semibold flex items-center justify-center gap-2"
            >
                {disabled ? (
                    <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        处理中...
                    </>
                ) : (
                    <>
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        开始分析
                    </>
                )}
            </button>
        </div>
    );
}
