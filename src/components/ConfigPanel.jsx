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

    // AI Configuration
    const [aiConfig, setAiConfig] = useState(() => {
        const saved = localStorage.getItem('visioncull-ai-config');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { }
        }
        return {
            enabled: false,
            apiUrl: 'https://api.openai.com/v1',
            apiKey: '',
            model: 'gpt-4o-mini',
            prompt: '作为一个专业图库筛选师，分析这张照片的内容和质量。\n请返回JSON:\n{\n  "keep": true/false,\n  "reason": "简短的一句话理由",\n  "tags": ["人像", "合照", "逆光", "模糊"],\n  "score": 85\n}'
        };
    });

    const [isAiSettingsOpen, setIsAiSettingsOpen] = useState(true);

    // File scan results
    const [scanResult, setScanResult] = useState(null);
    const [isScanning, setIsScanning] = useState(false);

    const formatFilter = rawEnabled && jpgEnabled ? 'all' : rawEnabled ? 'raw' : jpgEnabled ? 'jpg' : null;

    const saveAiConfig = (newConfig) => {
        setAiConfig(newConfig);
        localStorage.setItem('visioncull-ai-config', JSON.stringify(newConfig));
    };

    const updateAiConfig = (key, value) => {
        saveAiConfig({ ...aiConfig, [key]: value });
    };

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
            setErrorMsg('请先选择需要分析的目标文件夹');
            return;
        }
        if (!formatFilter) {
            setErrorMsg('请至少选择一种处理类型 (RAW 或 JPG)');
            return;
        }
        if (aiConfig.enabled && (!aiConfig.apiUrl || !aiConfig.apiKey)) {
            setErrorMsg('请填写完整的 AI Api 配置 (URL 和 Key)');
            setIsAiSettingsOpen(true);
            return;
        }
        setErrorMsg('');
        onStart(path, threshold, formatFilter, aiConfig);
    };

    const thresholdLabel =
        threshold < 300 ? 'LOOSE' :
            threshold < 500 ? 'STANDARD' : 'STRICT';

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto pr-3 -mr-3 pb-6 flex flex-col gap-10 cs-scroll">

                {/* Section: Folder Selection */}
                <div className="space-y-4">
                    <label className="text-[10px] font-bold text-text-secondary tracking-widest uppercase block">
                        目标文件夹
                    </label>

                    <div
                        onClick={!disabled && !isSelecting ? handleSelectPath : undefined}
                        className={`group relative overflow-hidden rounded-xl border border-border bg-white/[0.02] p-4 cursor-pointer transition-all duration-300 hover:bg-white/[0.04] hover:border-white/10 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {path ? (
                            <div className="flex items-center gap-4 relative z-10">
                                <div className="p-2 rounded-lg bg-accent/10 text-accent ring-1 ring-accent/20">
                                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                                    </svg>
                                </div>
                                <div className="flex flex-col overflow-hidden">
                                    <span className="text-sm font-medium text-text-primary truncate">{path.split('/').pop()}</span>
                                    <span className="text-[10px] font-mono text-text-muted truncate mt-0.5">{path}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-4 relative z-10">
                                <div className="p-2 rounded-lg bg-surface text-text-muted transition-colors group-hover:text-accent group-hover:bg-accent/10 group-hover:ring-1 group-hover:ring-accent/20">
                                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                                    </svg>
                                </div>
                                <span className="text-xs tracking-wide font-medium text-text-secondary group-hover:text-text-primary transition-colors">
                                    {isSelecting ? '加载中...' : '选择分析目录'}
                                </span>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out"></div>
                    </div>
                </div>

                {/* Section: Format Filter */}
                <div className="space-y-4">
                    <label className="text-[10px] font-bold text-text-secondary tracking-widest uppercase block">
                        处理类型
                    </label>
                    <div className="flex gap-4">
                        <label className={`flex-1 flex justify-center items-center gap-2.5 py-3 rounded-lg border text-xs font-mono tracking-wider transition-all cursor-pointer ${rawEnabled ? 'bg-accent/10 border-accent/30 text-accent' : 'bg-white/[0.02] border-border text-text-muted hover:bg-white/[0.04]'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            <input
                                type="checkbox"
                                className="hidden"
                                checked={rawEnabled}
                                onChange={(e) => handleFormatChange(setRawEnabled, e.target.checked)}
                                disabled={disabled || (!jpgEnabled && rawEnabled)}
                            />
                            {rawEnabled && <div className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(var(--color-accent),0.6)] animate-fade-in" />}
                            RAW
                        </label>
                        <label className={`flex-1 flex justify-center items-center gap-2.5 py-3 rounded-lg border text-xs font-mono tracking-wider transition-all cursor-pointer ${jpgEnabled ? 'bg-accent/10 border-accent/30 text-accent' : 'bg-white/[0.02] border-border text-text-muted hover:bg-white/[0.04]'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            <input
                                type="checkbox"
                                className="hidden"
                                checked={jpgEnabled}
                                onChange={(e) => handleFormatChange(setJpgEnabled, e.target.checked)}
                                disabled={disabled || (!rawEnabled && jpgEnabled)}
                            />
                            {jpgEnabled && <div className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(var(--color-accent),0.6)] animate-fade-in" />}
                            JPG
                        </label>
                    </div>
                </div>

                {/* Scan Summary Container - Minimalist Stats */}
                <div className={`transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden ${scanResult ? 'opacity-100 max-h-40' : 'opacity-0 max-h-0'}`}>
                    {scanResult && (
                        <div className="flex items-end gap-6 px-1">
                            <div>
                                <div className="text-[10px] font-mono text-text-muted mb-1.5">检索总数</div>
                                <div className="text-3xl font-light text-text-primary tracking-tight leading-none">{scanResult.total}</div>
                            </div>
                            <div className="flex flex-col gap-1.5 pb-0.5">
                                {scanResult.rawCount > 0 && (
                                    <span className="flex items-center gap-2 text-[10px] font-mono text-text-secondary tracking-widest"><span className="w-1 h-1 rounded-full bg-text-muted"></span> RAW <span className="text-text-primary">{scanResult.rawCount}</span></span>
                                )}
                                {scanResult.jpgCount > 0 && (
                                    <span className="flex items-center gap-2 text-[10px] font-mono text-text-secondary tracking-widest"><span className="w-1 h-1 rounded-full bg-text-muted"></span> JPG <span className="text-text-primary">{scanResult.jpgCount}</span></span>
                                )}
                            </div>
                            {isScanning && (
                                <div className="ml-auto pb-1 text-[10px] text-accent animate-pulse font-mono tracking-wider">扫描中...</div>
                            )}
                        </div>
                    )}
                </div>

                {/* Section: Threshold / Sensitivity */}
                <div className="space-y-5">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-text-secondary tracking-widest uppercase">
                            判定严格度
                        </label>
                        <span className="text-sm font-mono text-accent bg-accent/10 px-2.5 py-0.5 rounded text-center min-w-[44px]">{threshold}</span>
                    </div>

                    <div className="relative pt-1">
                        <input
                            type="range"
                            min="0" max="800" step="10"
                            value={threshold}
                            onChange={(e) => setThreshold(parseInt(e.target.value))}
                            disabled={disabled}
                            className="w-full h-1 bg-surface rounded-full appearance-none cursor-pointer accent-accent outline-none focus:ring-2 focus:ring-accent/20 transition-all slider-sleek"
                        />
                        <div className="flex justify-between text-[9px] text-text-muted mt-3 font-mono uppercase tracking-widest">
                            <span>宽松 <span className="lowercase normal-case block mt-0.5 opacity-60 text-[8px] tracking-normal">(保留更多)</span></span>
                            <span className="text-right">严格 <span className="lowercase normal-case block mt-0.5 opacity-60 text-[8px] tracking-normal">(保留更少)</span></span>
                        </div>
                    </div>
                </div>

                {/* Section: AI Configuration */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-border pb-3">
                        <label className="flex items-center gap-2.5 text-[10px] font-bold text-text-primary tracking-widest uppercase cursor-pointer group" onClick={() => setIsAiSettingsOpen(!isAiSettingsOpen)}>
                            <svg className={`w-4 h-4 transition-transform duration-300 ${aiConfig.enabled ? 'text-status-keep' : 'text-text-muted group-hover:text-text-secondary'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                            </svg>
                            AI 增强选片
                            <svg className={`w-3 h-3 text-text-muted ml-1 transition-transform duration-500 ${isAiSettingsOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </label>

                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={aiConfig.enabled}
                                onChange={(e) => updateAiConfig('enabled', e.target.checked)}
                                disabled={disabled}
                            />
                            <div className="w-10 h-5 bg-surface peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-white/10 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-status-keep shadow-inner"></div>
                        </label>
                    </div>

                    <div className={`transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden ${isAiSettingsOpen ? 'opacity-100 max-h-[800px]' : 'opacity-0 max-h-0'}`}>
                        <div className="space-y-5 px-1 pb-2">
                            <div>
                                <label className="text-[9px] text-text-muted mb-2 tracking-widest block uppercase">API 接口地址</label>
                                <input
                                    type="text"
                                    value={aiConfig.apiUrl}
                                    onChange={(e) => updateAiConfig('apiUrl', e.target.value)}
                                    disabled={disabled}
                                    className="w-full bg-black/20 border border-border text-text-primary px-3 py-2.5 rounded-lg text-xs font-mono outline-none transition-all duration-300 focus:border-accent/40 focus:bg-black/40 hover:border-white/10 placeholder:text-text-muted/50"
                                    placeholder="https://api.openai.com/v1"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] text-text-muted mb-2 tracking-widest block uppercase">API 密钥</label>
                                <input
                                    type="password"
                                    value={aiConfig.apiKey}
                                    onChange={(e) => updateAiConfig('apiKey', e.target.value)}
                                    disabled={disabled}
                                    className="w-full bg-black/20 border border-border text-text-primary px-3 py-2.5 rounded-lg text-xs font-mono outline-none transition-all duration-300 focus:border-accent/40 focus:bg-black/40 hover:border-white/10 placeholder:text-text-muted/50"
                                    placeholder="sk-..."
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Error & Action Button - fixed at bottom */}
            <div className="pt-4 mt-2 border-t border-border bg-transparent shrink-0">
                {errorMsg && (
                    <div className="p-3 mb-4 bg-status-reject/10 border border-status-reject/20 rounded-xl text-status-reject font-mono text-[10px] tracking-widest uppercase animate-fade-in flex items-center gap-3">
                        <span className="w-1.5 h-1.5 bg-status-reject shadow-[0_0_8px_rgba(244,63,94,0.6)] rounded-full animate-pulse shrink-0"></span>
                        <span className="break-all">{errorMsg}</span>
                    </div>
                )}

                <button
                    onClick={handleStart}
                    disabled={disabled || !path || !formatFilter}
                    className="w-full h-12 bg-accent hover:bg-accent/90 focus:ring-4 focus:ring-accent/30 text-white text-xs font-bold tracking-widest uppercase rounded-xl transition-all shadow-[0_4px_14px_0_rgba(var(--color-accent),0.39)] hover:shadow-[0_6px_20px_rgba(var(--color-accent),0.23)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-accent disabled:hover:shadow-none flex items-center justify-center gap-3 outline-none"
                >
                    {disabled ? (
                        <>
                            <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin shrink-0"></span>
                            <span>分析中...</span>
                        </>
                    ) : (
                        <>
                            <span>开始增强分析</span>
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                                <polyline points="12 5 19 12 12 19"></polyline>
                            </svg>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
