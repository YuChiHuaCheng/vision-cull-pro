import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Bridge } from '../utils/bridge';

const TABS = [
    { key: 'all', label: 'ALL FILES' },
    { key: 'keep', label: 'KEPT' },
    { key: 'reject', label: 'REJECT' },
    { key: 'failed', label: 'FAILED' },
    { key: 'modified', label: 'MODIFIED' },
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
        <div ref={ref} className="w-full h-full bg-panel">
            {isVisible && (
                <img src={src} alt={alt} className="w-full h-full object-cover opacity-0 transition-opacity duration-300" onLoad={(e) => e.target.classList.remove('opacity-0')} loading="lazy" draggable={false} />
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
            const photo = filteredPhotos[selectedIndex];
            if (e.key === ' ') { 
                e.preventDefault(); 
                if (photo) toggleVerdict(photo);
                return; 
            }
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
            setExportMsg(res.success ? `COPIED: ${res.copied || keepFiles.length}` : 'COPY FAILED');
        } catch { setExportMsg('SYS_ERROR'); }
        finally { setTimeout(() => setExportBusy(false), 500); }
    };

    const handleXmpCheck = async () => {
        if (exportBusy) return;
        setExportBusy(true); setExportMsg('');
        try {
            const res = await Bridge.checkXmpConflict(folderPath, photos);
            if (res.conflict) { setXmpConflictCount(res.conflictCount || 0); setShowXmpModal(true); }
            else { await doCreateXmp(false); }
        } catch { setExportMsg('XMP_CHECK_FAILED'); }
        finally { setExportBusy(false); }
    };

    const doCreateXmp = async (overwrite) => {
        setShowXmpModal(false); setExportBusy(true);
        try {
            const results = scanResults.map(r => ({ ...r, keep: getVerdict(r.fileName) === 'keep', tags: r.tags || [] }));
            const res = await Bridge.createXmp(folderPath, results, overwrite);
            setExportMsg(res.success ? `XMP CREATED: ${res.created || results.length}` : 'XMP_CREATE_FAILED');
        } catch { setExportMsg('XMP_SYS_ERROR'); }
        finally { setTimeout(() => setExportBusy(false), 500); }
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
                <div className="max-w-[90vw] max-h-[90vh] relative flex flex-col items-center" onClick={e => e.stopPropagation()}>
                    {/* Navigation */}
                    {lightboxIndex > 0 && (
                        <button className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-16 w-12 h-12 border border-white/20 bg-base/50 backdrop-blur hover:bg-white/10 hover:border-accent flex items-center justify-center text-white transition-all group rounded-sm" onClick={() => setLightboxIndex(p => p - 1)}>
                            <svg className="w-6 h-6 group-hover:-translate-x-1 transition-transform text-text-primary group-hover:text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
                        </button>
                    )}
                    {lightboxIndex < filteredPhotos.length - 1 && (
                        <button className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-16 w-12 h-12 border border-white/20 bg-base/50 backdrop-blur hover:bg-white/10 hover:border-accent flex items-center justify-center text-white transition-all group rounded-sm" onClick={() => setLightboxIndex(p => p + 1)}>
                            <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform text-text-primary group-hover:text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
                        </button>
                    )}

                    {/* Image Container */}
                    <div className="relative border border-border bg-base rounded flex items-center justify-center p-1">
                        <img src={imageSrc} alt={photoName} className="max-w-full max-h-[75vh] object-contain rounded-sm" draggable={false} />

                        {/* Image Metadata Overlay */}
                        <div className="absolute top-4 left-4 flex flex-col gap-1 drop-shadow-md mix-blend-difference text-white pointer-events-none">
                            <span className="text-xs font-sans font-medium tracking-wide">{photoName}</span>
                            <span className="text-[10px] font-sans text-white/80">{lightboxIndex + 1} / {filteredPhotos.length}</span>
                        </div>
                    </div>

                    {/* Control Panel */}
                    <div className="mt-4 flex flex-col md:flex-row items-center justify-between w-full max-w-2xl bg-surface border border-border p-4 rounded-md shadow-soft-sm">
                        <div className="flex flex-col mb-4 md:mb-0">
                            <p className="text-xs text-text-muted font-medium flex items-center gap-2">
                                Analysis Result
                            </p>
                            <p className="text-sm text-text-primary font-medium mt-1">{result?.reason || 'Manual Override'}</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                className={`px-4 py-2 rounded-md text-xs font-medium transition-colors border ${verdict === 'keep' ? 'bg-status-keep-dim text-status-keep border-status-keep/30' : 'bg-base text-text-secondary border-border hover:border-status-keep/30 hover:text-status-keep'}`}
                                onClick={() => setVerdictForPhoto(photoName, 'keep')}
                            ><kbd className="mr-2 !border-none !bg-transparent text-inherit !p-0">P</kbd> Keep</button>
                            <button
                                className={`px-4 py-2 rounded-md text-xs font-medium transition-colors border ${verdict === 'reject' ? 'bg-status-reject-dim text-status-reject border-status-reject/30' : 'bg-base text-text-secondary border-border hover:border-status-reject/30 hover:text-status-reject'}`}
                                onClick={() => setVerdictForPhoto(photoName, 'reject')}
                            ><kbd className="mr-2 !border-none !bg-transparent text-inherit !p-0">X</kbd> Reject</button>
                            {overrides[photoName] && (
                                <button className="px-4 py-2 rounded-md text-xs font-medium bg-base text-text-secondary border border-border hover:text-text-primary" onClick={() => removeOverride(photoName)}>
                                    <kbd className="mr-2 !border-none !bg-transparent text-inherit !p-0">U</kbd> Reset
                                </button>
                            )}
                        </div>
                    </div>

                    <button className="fixed top-6 right-6 w-10 h-10 border border-border bg-surface hover:bg-border flex items-center justify-center text-text-muted hover:text-text-primary transition-colors rounded-full shadow-soft-sm" onClick={() => setLightboxIndex(-1)}>
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                </div>
            </div>
        );
    };

    const bestFaces = useMemo(() => {
        const bestIds = new Set();
        scanResults.forEach(r => {
            if(!r.faces || r.faces.length === 0) return;
            let bestIdx = -1;
            let maxScore = -1;
            r.faces.forEach((f, idx) => {
                if(!f.is_blink && f.laplacian > maxScore) {
                    maxScore = f.laplacian;
                    bestIdx = idx;
                }
            });
            if(bestIdx >= 0) {
                bestIds.add(`${r.fileName}_${bestIdx}`);
            }
        });
        return bestIds;
    }, [scanResults]);

    // ---- Empty State ----
    if (!photos.length && !isComplete) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-text-muted">
                <div className="w-16 h-16 border-2 border-dashed border-text-muted/30 flex items-center justify-center mb-4 rounded-sm relative">
                    <div className="absolute inset-0 border border-text-muted/10 m-1"></div>
                    <svg className="w-6 h-6 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </div>
                <p className="text-[10px] font-mono tracking-[0.2em] uppercase text-text-muted/70">Awaiting visual input</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-base transition-colors duration-300">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-panel/80 backdrop-blur-md z-20 flex-shrink-0 transition-colors duration-300">
                <div className="flex items-center gap-2">
                    {TABS.map(tab => (
                        <button key={tab.key} className={`filter-tab ${activeTab === tab.key ? 'active shadow-[0_4px_12px_rgba(var(--color-accent),0.2)] bg-surface' : ''}`} onClick={() => setActiveTab(tab.key)}>
                            {tab.label}
                            {tab.key === 'keep' && <span className="ml-2 text-status-keep">[{stats.keep}]</span>}
                            {tab.key === 'reject' && <span className="ml-2 text-status-reject">[{stats.reject}]</span>}
                            {tab.key === 'failed' && stats.failed > 0 && <span className="ml-2 text-status-fail">[{stats.failed}]</span>}
                            {tab.key === 'modified' && stats.modified > 0 && <span className="ml-2 text-accent">[{stats.modified}]</span>}
                        </button>
                    ))}
                </div>
                {isComplete && (
                    <div className="flex items-center gap-3">
                        <button className="text-xs font-medium text-text-muted hover:text-status-keep transition-colors flex items-center gap-1" onClick={selectAll}>
                            全选保留
                        </button>
                        <span className="text-border">/</span>
                        <button className="text-xs font-medium text-text-muted hover:text-status-reject transition-colors flex items-center gap-1" onClick={deselectAll}>
                            全选淘汰
                        </button>
                    </div>
                )}
            </div>

            {/* Photo Grid */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 xl:p-6 bg-base relative pb-24 transition-colors duration-300">
                {filteredPhotos.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                        {filteredPhotos.map((photoName, index) => {
                            const verdict = getVerdict(photoName);
                            const isSelected = index === selectedIndex;
                            const result = scanResults.find(r => r.fileName === photoName);
                            const faces = result?.faces || [];

                            return (
                                <div
                                    key={photoName}
                                    className={`photo-card group aspect-[3/4] flex flex-col ${isSelected ? 'selected ring-2 ring-accent shadow-[0_0_20px_var(--color-accent-dim)]' : ''}`}
                                    onClick={(e) => handleCardClick(index, e)}
                                    title="Double click to expand / Space to toggle"
                                    onDoubleClick={() => setLightboxIndex(index)}
                                >
                                    <div className="flex-1 relative overflow-hidden bg-panel flex items-center justify-center transition-colors duration-300">
                                        <LazyImage src={getImageSrc(photoName, index)} alt={photoName} />
                                        
                                        {/* Status Badge */}
                                        <button
                                            className={`status-badge ${verdict}`}
                                            onClick={(e) => { e.stopPropagation(); toggleVerdict(photoName); }}
                                            title={verdict === 'keep' ? 'KEEP' : verdict === 'reject' ? 'REJECT' : 'FAIL'}
                                        >
                                            {verdict === 'keep' ? 'K' : verdict === 'reject' ? 'R' : '!'}
                                        </button>

                                        {/* Override indicator */}
                                        {overrides[photoName] && (
                                            <div className="absolute top-0 left-0 border-t-[20px] border-r-[20px] border-t-accent border-r-transparent shadow-glow-accent z-20"></div>
                                        )}
                                        
                                        <div className="absolute inset-0 bg-base/5 group-hover:bg-transparent pointer-events-none transition-colors duration-300"></div>
                                    </div>
                                    
                                    {/* Filmstrip Face Drawer */}
                                    <div className="h-14 bg-surface border-t border-border flex items-center px-2 gap-2 overflow-x-auto cs-scroll flex-shrink-0 relative">
                                        {faces.map((f, fi) => (
                                            <div key={fi} className="relative group/face flex-shrink-0">
                                                <img 
                                                    src={f.image_b64} 
                                                    className={`w-10 h-10 object-cover rounded shadow-sm face-crop border ${f.is_blink ? 'border-status-reject/50 opacity-80' : 'border-white/10'}`} 
                                                    alt="face" 
                                                />
                                                {/* Metric Overlays (D) */}
                                                <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-black/90 text-white text-[9px] font-mono px-1.5 py-0.5 rounded opacity-0 group-hover/face:opacity-100 whitespace-nowrap z-[110] shadow-xl pointer-events-none transform -translate-y-2 group-hover/face:translate-y-0 transition-all duration-200">
                                                    {f.laplacian.toFixed(1)} L | {f.ear.toFixed(2)} E
                                                </div>
                                                {/* Magic Star (A) */}
                                                {bestFaces.has(`${photoName}_${fi}`) && (
                                                    <div className="absolute -top-2 -right-2 text-[14px] filter drop-shadow-[0_0_8px_rgba(74,222,128,0.8)] z-30 pointer-events-none">⭐</div>
                                                )}
                                                {f.is_blink && (
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded text-status-reject text-xs font-bold font-mono pointer-events-none z-20">
                                                        X
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Footer Name label */}
                                    <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-white/80 max-w-[70%] truncate pointer-events-none group-hover:opacity-100 opacity-0 transition-opacity">
                                        {photoName}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full text-text-muted text-[10px] font-mono tracking-[0.2em] uppercase">
                        ZERO MATCHES FOUND IN CURRENT FILTER
                    </div>
                )}
            </div>

            {/* Export Bar (E) */}
            {isComplete && photos.length > 0 && (
                <div className="absolute bottom-12 left-1/2 -translate-x-1/2 shadow-soft-md z-40 bg-panel/95 backdrop-blur-xl rounded-full border border-border px-6 py-3 flex items-center justify-between gap-8 flex-shrink-0 animate-slide-up transition-colors duration-300">
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-semibold tracking-wide text-text-primary">
                            ✓ 审查模式完毕
                        </span>
                        {exportMsg && <span className="text-xs font-medium text-text-muted bg-surface px-3 py-1.5 rounded border border-border animate-fade-in">{exportMsg}</span>}
                    </div>

                    <div className="flex items-center gap-3">
                        <button className="px-6 py-2 bg-text-primary text-base hover:bg-text-secondary text-xs font-bold uppercase tracking-widest rounded-full transition-colors shadow-soft-sm" onClick={handleCopy} disabled={exportBusy}>
                            批量导出保留组
                        </button>
                    </div>
                </div>
            )}

            {/* Terminal Status Bar */}
            <div className="terminal-bar flex-shrink-0 border-t border-border bg-panel transition-colors duration-300">
                <div className="terminal-stat"><div className="dot bg-status-keep shadow-[0_0_8px_var(--status-keep-dim)]" /><span>KEEP:{stats.keep}</span></div>
                <div className="terminal-stat"><div className="dot bg-status-reject shadow-[0_0_8px_var(--status-reject-dim)]" /><span>REJECT:{stats.reject}</span></div>
                {stats.failed > 0 && <div className="terminal-stat"><div className="dot bg-status-fail shadow-[0_0_8px_var(--status-fail-dim)]" /><span>FAIL:{stats.failed}</span></div>}
                {stats.modified > 0 && <div className="terminal-stat"><div className="dot bg-accent" /><span className="text-accent">MODIFIED:{stats.modified}</span></div>}
                <div className="flex-1" />
                <div className="flex items-center gap-4 text-[9px] text-text-muted/60 font-mono tracking-widest uppercase">
                    <span className="flex items-center gap-1.5"><kbd className="!bg-surface !border-border text-text-secondary">P</kbd> 保留</span>
                    <span className="flex items-center gap-1.5"><kbd className="!bg-surface !border-border text-text-secondary">X</kbd> 淘汰</span>
                    <span className="flex items-center gap-1.5"><kbd className="!bg-surface !border-border text-text-secondary">SPACE</kbd> 切换</span>
                    <span className="flex items-center gap-1.5"><kbd className="!bg-surface !border-border text-text-secondary">DBL-CLK</kbd> 放大</span>
                </div>
            </div>

            {renderLightbox()}

            {/* Modal */}
            {showXmpModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-base/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-surface border border-border rounded-lg p-6 max-w-sm w-full shadow-soft-md">

                        <h3 className="text-lg font-semibold text-text-primary mb-2">
                            XMP 冲突
                        </h3>
                        <p className="text-sm text-text-secondary mb-6 leading-relaxed">检测到目标文件夹已有 <span className="text-text-primary font-semibold">{xmpConflictCount}</span> 个 XMP 文件，请选择处理方式。</p>

                        <div className="flex flex-col gap-3">
                            <button className="btn-danger w-full py-2.5" onClick={() => doCreateXmp(true)}>覆盖历史文件</button>
                            <button className="btn-secondary w-full py-2.5" onClick={() => doCreateXmp(false)}>保留历史文件并跳过</button>
                            <button className="text-sm font-medium text-text-muted hover:text-text-primary mt-2 transition-colors text-center py-2" onClick={() => { setShowXmpModal(false); setExportBusy(false); }}>取消导出</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
