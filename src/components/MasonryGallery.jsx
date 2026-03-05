import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Bridge } from '../utils/bridge';

const TABS = [
    { key: 'all', label: '全部' },
    { key: 'keep', label: '保留' },
    { key: 'reject', label: '淘汰' },
    { key: 'failed', label: '失败' },
    { key: 'modified', label: '已修改' },
];

// Lazy image with IntersectionObserver
function LazyImage({ src, alt }) {
    const [isVisible, setIsVisible] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); observer.disconnect(); } },
            { rootMargin: '200px' }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return (
        <div ref={ref} className="w-full h-full bg-surface">
            {isVisible && (
                <img src={src} alt={alt} className="w-full h-full object-cover" loading="lazy" draggable={false} />
            )}
        </div>
    );
}

export default function MasonryGallery({ photos, folderPath, isComplete, scanResults }) {
    const [activeTab, setActiveTab] = useState('all');
    const [overrides, setOverrides] = useState({});
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [lightboxIndex, setLightboxIndex] = useState(-1);
    const [lastClickIndex, setLastClickIndex] = useState(-1);

    // Export
    const [exportBusy, setExportBusy] = useState(false);
    const [exportMsg, setExportMsg] = useState('');
    const [showXmpModal, setShowXmpModal] = useState(false);
    const [xmpConflictCount, setXmpConflictCount] = useState(0);

    // ---- Derived ----
    const getVerdict = useCallback((fileName) => {
        if (overrides[fileName]) return overrides[fileName];
        const result = scanResults.find(r => r.fileName === fileName);
        if (!result) return 'unknown';
        if (result.keep === undefined) return 'failed';
        return result.keep ? 'keep' : 'reject';
    }, [overrides, scanResults]);

    const filteredPhotos = useMemo(() => {
        return photos.filter(photo => {
            const verdict = getVerdict(photo);
            if (activeTab === 'all') return true;
            if (activeTab === 'keep') return verdict === 'keep';
            if (activeTab === 'reject') return verdict === 'reject';
            if (activeTab === 'failed') return verdict === 'failed' || verdict === 'unknown';
            if (activeTab === 'modified') return !!overrides[photo];
            return true;
        });
    }, [photos, activeTab, getVerdict, overrides]);

    const stats = useMemo(() => {
        let keep = 0, reject = 0, failed = 0, modified = 0;
        for (const photo of photos) {
            const v = getVerdict(photo);
            if (v === 'keep') keep++;
            else if (v === 'reject') reject++;
            else failed++;
            if (overrides[photo]) modified++;
        }
        return { keep, reject, failed, modified, total: photos.length };
    }, [photos, getVerdict, overrides]);

    // ---- Actions ----
    const setVerdictForPhoto = useCallback((fileName, verdict) => {
        setOverrides(prev => ({ ...prev, [fileName]: verdict }));
    }, []);

    const toggleVerdict = useCallback((fileName) => {
        setOverrides(prev => {
            const current = getVerdict(fileName);
            const newVerdict = current === 'keep' ? 'reject' : 'keep';
            return { ...prev, [fileName]: newVerdict };
        });
    }, [getVerdict]);

    const removeOverride = useCallback((fileName) => {
        setOverrides(prev => { const next = { ...prev }; delete next[fileName]; return next; });
    }, []);

    const selectAll = useCallback(() => {
        const newO = {};
        filteredPhotos.forEach(p => { newO[p] = 'keep'; });
        setOverrides(prev => ({ ...prev, ...newO }));
    }, [filteredPhotos]);

    const deselectAll = useCallback(() => {
        const newO = {};
        filteredPhotos.forEach(p => { newO[p] = 'reject'; });
        setOverrides(prev => ({ ...prev, ...newO }));
    }, [filteredPhotos]);

    // ---- Keyboard ----
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isComplete || filteredPhotos.length === 0) return;
            if (lightboxIndex >= 0) {
                if (e.key === 'Escape' || e.key === ' ') { e.preventDefault(); setLightboxIndex(-1); return; }
                if (e.key === 'ArrowLeft') { e.preventDefault(); setLightboxIndex(p => Math.max(0, p - 1)); return; }
                if (e.key === 'ArrowRight') { e.preventDefault(); setLightboxIndex(p => Math.min(filteredPhotos.length - 1, p + 1)); return; }
                const photo = filteredPhotos[lightboxIndex];
                if (photo) {
                    if (e.key === 'p' || e.key === 'P') { setVerdictForPhoto(photo, 'keep'); return; }
                    if (e.key === 'x' || e.key === 'X') { setVerdictForPhoto(photo, 'reject'); return; }
                    if (e.key === 'u' || e.key === 'U') { removeOverride(photo); return; }
                }
                return;
            }
            if (e.key === 'ArrowLeft') { e.preventDefault(); setSelectedIndex(p => Math.max(0, p - 1)); return; }
            if (e.key === 'ArrowRight') { e.preventDefault(); setSelectedIndex(p => Math.min(filteredPhotos.length - 1, p + 1)); return; }
            if (e.key === ' ') { e.preventDefault(); if (selectedIndex >= 0) setLightboxIndex(selectedIndex); return; }
            const photo = filteredPhotos[selectedIndex];
            if (photo) {
                if (e.key === 'p' || e.key === 'P') { setVerdictForPhoto(photo, 'keep'); return; }
                if (e.key === 'x' || e.key === 'X') { setVerdictForPhoto(photo, 'reject'); return; }
                if (e.key === 'u' || e.key === 'U') { removeOverride(photo); return; }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isComplete, filteredPhotos, lightboxIndex, selectedIndex, setVerdictForPhoto, removeOverride]);

    // ---- Click ----
    const handleCardClick = useCallback((index, e) => {
        if (e.shiftKey && lastClickIndex >= 0) {
            const start = Math.min(lastClickIndex, index);
            const end = Math.max(lastClickIndex, index);
            const newO = {};
            for (let i = start; i <= end; i++) newO[filteredPhotos[i]] = 'keep';
            setOverrides(prev => ({ ...prev, ...newO }));
        } else {
            setSelectedIndex(index);
            setLightboxIndex(index);
        }
        setLastClickIndex(index);
    }, [lastClickIndex, filteredPhotos]);

    // ---- Export ----
    const handleCopy = async () => {
        if (exportBusy) return;
        setExportBusy(true); setExportMsg('');
        try {
            const keepFiles = photos.filter(p => getVerdict(p) === 'keep');
            const res = await Bridge.copyFiles(folderPath, keepFiles);
            setExportMsg(res.success ? `✅ 已复制 ${res.copied || keepFiles.length} 张` : '❌ 复制失败');
        } catch { setExportMsg('❌ 操作异常'); }
        finally { setExportBusy(false); }
    };

    const handleXmpCheck = async () => {
        if (exportBusy) return;
        setExportBusy(true); setExportMsg('');
        try {
            const res = await Bridge.checkXmpConflict(folderPath, photos);
            if (res.conflict) { setXmpConflictCount(res.conflictCount || 0); setShowXmpModal(true); }
            else { await doCreateXmp(false); }
        } catch { setExportMsg('❌ XMP 检查失败'); }
        finally { setExportBusy(false); }
    };

    const doCreateXmp = async (overwrite) => {
        setShowXmpModal(false); setExportBusy(true);
        try {
            const results = scanResults.map(r => ({ ...r, keep: getVerdict(r.fileName) === 'keep', tags: r.tags || [] }));
            const res = await Bridge.createXmp(folderPath, results, overwrite);
            setExportMsg(res.success ? `✅ 已创建 ${res.created || results.length} 个 XMP` : '❌ XMP 创建失败');
        } catch { setExportMsg('❌ XMP 操作异常'); }
        finally { setExportBusy(false); }
    };

    // ---- Image Source Helper ----
    const getImageSrc = (photoName, index) => {
        const isMock = photoName.startsWith('photo_');
        if (isMock) return `https://picsum.photos/seed/${index + 1}/300/300`;
        const result = scanResults.find(r => r.fileName === photoName);
        return result?.previewPath ? `local://${result.previewPath}` : `local://${folderPath}/${photoName}`;
    };

    // ---- Lightbox ----
    const renderLightbox = () => {
        if (lightboxIndex < 0 || lightboxIndex >= filteredPhotos.length) return null;
        const photoName = filteredPhotos[lightboxIndex];
        const verdict = getVerdict(photoName);
        const result = scanResults.find(r => r.fileName === photoName);
        const isMock = photoName.startsWith('photo_');
        const imageSrc = isMock
            ? `https://picsum.photos/seed/${lightboxIndex + 1}/800/800`
            : (result?.previewPath ? `local://${result.previewPath}` : `local://${folderPath}/${photoName}`);

        return (
            <div className="lightbox-overlay" onClick={() => setLightboxIndex(-1)}>
                <div className="max-w-[85vw] max-h-[85vh] relative" onClick={e => e.stopPropagation()}>
                    {lightboxIndex > 0 && (
                        <button className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-12 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors" onClick={() => setLightboxIndex(p => p - 1)}>←</button>
                    )}
                    {lightboxIndex < filteredPhotos.length - 1 && (
                        <button className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-12 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors" onClick={() => setLightboxIndex(p => p + 1)}>→</button>
                    )}
                    <img src={imageSrc} alt={photoName} className="max-w-full max-h-[75vh] object-contain rounded-lg" />
                    <div className="mt-3 flex items-center justify-between">
                        <div>
                            <p className="text-sm text-white/90 font-medium">{photoName}</p>
                            {result?.reason && <p className="text-xs text-white/50 mt-0.5">{result.reason}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${verdict === 'keep' ? 'bg-status-keep text-white' : 'bg-white/10 text-white/70 hover:bg-status-keep/30'}`}
                                onClick={() => setVerdictForPhoto(photoName, 'keep')}
                            ><kbd className="mr-1 bg-transparent border-0 !text-inherit !min-w-0 !h-auto !p-0">P</kbd> 保留</button>
                            <button
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${verdict === 'reject' ? 'bg-status-reject text-white' : 'bg-white/10 text-white/70 hover:bg-status-reject/30'}`}
                                onClick={() => setVerdictForPhoto(photoName, 'reject')}
                            ><kbd className="mr-1 bg-transparent border-0 !text-inherit !min-w-0 !h-auto !p-0">X</kbd> 淘汰</button>
                            {overrides[photoName] && (
                                <button className="px-3 py-1.5 rounded-md text-xs font-medium bg-white/10 text-white/70 hover:bg-white/20" onClick={() => removeOverride(photoName)}>
                                    <kbd className="mr-1 bg-transparent border-0 !text-inherit !min-w-0 !h-auto !p-0">U</kbd> 撤销
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="absolute top-2 right-2 text-xs text-white/50 bg-black/50 px-2 py-1 rounded">{lightboxIndex + 1} / {filteredPhotos.length}</div>
                    <button className="absolute top-2 left-2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white/70 hover:text-white transition-colors" onClick={() => setLightboxIndex(-1)}>✕</button>
                </div>
            </div>
        );
    };

    // ---- Empty State ----
    if (!photos.length && !isComplete) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-text-muted">
                <svg className="w-12 h-12 mb-3 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                    <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm">等待照片导入...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border flex-shrink-0">
                <div className="flex items-center gap-1">
                    {TABS.map(tab => (
                        <button key={tab.key} className={`filter-tab ${activeTab === tab.key ? 'active' : ''}`} onClick={() => setActiveTab(tab.key)}>
                            {tab.label}
                            {tab.key === 'keep' && <span className="ml-1 text-status-keep">{stats.keep}</span>}
                            {tab.key === 'reject' && <span className="ml-1 text-status-reject">{stats.reject}</span>}
                            {tab.key === 'failed' && stats.failed > 0 && <span className="ml-1 text-status-fail">{stats.failed}</span>}
                            {tab.key === 'modified' && stats.modified > 0 && <span className="ml-1 text-accent">{stats.modified}</span>}
                        </button>
                    ))}
                </div>
                {isComplete && (
                    <div className="flex items-center gap-2">
                        <button className="text-[11px] text-text-muted hover:text-text-primary transition-colors" onClick={selectAll}>全选保留</button>
                        <span className="text-border">|</span>
                        <button className="text-[11px] text-text-muted hover:text-text-primary transition-colors" onClick={deselectAll}>全选淘汰</button>
                    </div>
                )}
            </div>

            {/* Photo Grid — CSS Grid with lazy loading */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                {filteredPhotos.length > 0 ? (
                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                        {filteredPhotos.map((photoName, index) => {
                            const verdict = getVerdict(photoName);
                            const isSelected = index === selectedIndex;

                            return (
                                <div
                                    key={photoName}
                                    className={`photo-card aspect-square relative ${isSelected ? 'ring-2 ring-accent' : ''}`}
                                    onClick={(e) => handleCardClick(index, e)}
                                >
                                    <LazyImage src={getImageSrc(photoName, index)} alt={photoName} />

                                    {/* Status Badge */}
                                    <button
                                        className={`status-badge ${verdict}`}
                                        onClick={(e) => { e.stopPropagation(); toggleVerdict(photoName); }}
                                        title={verdict === 'keep' ? '保留' : verdict === 'reject' ? '淘汰' : '失败'}
                                    >
                                        {verdict === 'keep' ? '✓' : verdict === 'reject' ? '✗' : '!'}
                                    </button>

                                    {/* Override dot */}
                                    {overrides[photoName] && (
                                        <div className="absolute top-2 left-2 w-1.5 h-1.5 rounded-full bg-accent" />
                                    )}

                                    {/* Hover filename */}
                                    <div className="absolute inset-x-0 bottom-0 px-2 py-1.5 bg-black/70 backdrop-blur-sm opacity-0 hover:opacity-100 transition-opacity">
                                        <p className="text-[10px] text-white/80 truncate">{photoName}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full text-text-muted text-sm">
                        当前筛选条件下无照片
                    </div>
                )}
            </div>

            {/* Status Bar */}
            <div className="status-bar flex-shrink-0">
                <div className="stat"><div className="dot bg-status-keep" /><span>保留: {stats.keep}</span></div>
                <div className="stat"><div className="dot bg-status-reject" /><span>淘汰: {stats.reject}</span></div>
                {stats.failed > 0 && <div className="stat"><div className="dot bg-status-fail" /><span>失败: {stats.failed}</span></div>}
                {stats.modified > 0 && <div className="stat"><div className="dot bg-accent" /><span>已修改: {stats.modified}</span></div>}
                <div className="flex-1" />
                <div className="flex items-center gap-2 text-[10px] text-text-muted">
                    <span><kbd>P</kbd> 保留</span>
                    <span><kbd>X</kbd> 淘汰</span>
                    <span><kbd>Space</kbd> 大图</span>
                </div>
            </div>

            {/* Export Bar */}
            {isComplete && photos.length > 0 && (
                <div className="flex items-center gap-3 px-4 py-3 border-t border-border bg-panel flex-shrink-0">
                    <button className="btn-secondary flex-1 flex items-center justify-center gap-2" onClick={handleCopy} disabled={exportBusy}>
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                        复制保留照片
                    </button>
                    <button className="btn-success flex-1 flex items-center justify-center gap-2" onClick={handleXmpCheck} disabled={exportBusy}>
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                        创建 XMP
                    </button>
                    {exportMsg && <span className="text-xs text-text-muted animate-fade-in">{exportMsg}</span>}
                </div>
            )}

            {renderLightbox()}

            {showXmpModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="card max-w-md w-full mx-4 p-6">
                        <h3 className="text-base font-semibold text-text-primary mb-2">XMP 文件冲突</h3>
                        <p className="text-sm text-text-secondary mb-4">检测到 {xmpConflictCount} 个已有 XMP 文件</p>
                        <div className="flex flex-col gap-2">
                            <button className="btn-danger w-full" onClick={() => doCreateXmp(true)}>覆盖现有</button>
                            <button className="btn-secondary w-full" onClick={() => doCreateXmp(false)}>跳过已有</button>
                            <button className="text-xs text-text-muted hover:text-text-primary mt-2 transition-colors" onClick={() => { setShowXmpModal(false); setExportBusy(false); }}>取消</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
