import React, { useEffect, useRef, useState } from 'react';

export default function ProgressMonitor({ 
    isScanning, 
    progressTotal, 
    progressCurrent, 
    statusMessage,
    isLogOpen,
    toggleLog 
}) {
    const logsContainerRef = useRef(null);
    const [logs, setLogs] = useState([]);

    const addLog = (text, status = 'info') => {
        setLogs(prev => [...prev, {
            time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 }),
            text,
            status
        }]);
    };

    // Auto scroll
    useEffect(() => {
        if (logsContainerRef.current) {
            logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
        }
    }, [logs]);

    // Track important state changes
    useEffect(() => {
        if (isScanning && progressCurrent === 0 && progressTotal > 0) {
            addLog(`ANALYZING BATCH [${progressTotal} items]`, 'highlight');
        }
    }, [isScanning, progressTotal]);

    useEffect(() => {
        if (statusMessage && statusMessage !== '等待执行指令...') {
            const isError = statusMessage.includes('错误') || statusMessage.includes('失败');
            addLog(statusMessage.toUpperCase(), isError ? 'error' : 'info');
        }
    }, [statusMessage]);

    const percent = progressTotal > 0 ? (progressCurrent / progressTotal) * 100 : 0;
    const isActive = isScanning || progressTotal > 0;

    return (
        <div className="flex flex-col h-full bg-transparent relative">
            {/* Header */}
            <div 
                className="flex items-center justify-between px-4 py-3 border-b border-border bg-transparent flex-shrink-0 z-10 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                onClick={toggleLog}
            >
                <div className="flex items-center gap-2">
                    <h2 className="text-[10px] font-bold text-text-secondary tracking-[0.2em] uppercase">
                        分析日志
                    </h2>
                    {isScanning && <div className="w-1.5 h-1.5 bg-accent animate-pulse rounded-full shadow-[0_0_8px_rgba(var(--color-accent),0.6)]"></div>}
                </div>
                <div className="flex items-center gap-4">
                    {isActive && (
                        <span className="text-[10px] font-medium text-text-secondary bg-surface px-2 border border-border rounded">
                            {progressCurrent}/{progressTotal}
                        </span>
                    )}
                    {/* Toggle Caret */}
                    <svg className={`w-4 h-4 text-text-muted transition-transform duration-300 ${isLogOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>

            {/* Conditionally reveal body */}
            {isLogOpen && (
                <>
                    {/* Progress Bar (Sticky Top) */}
            {isActive && (
                <div className="absolute top-[45px] left-0 right-0 z-10">
                    <div className="progress-bar rounded-none">
                        <div className="fill rounded-none" style={{ width: `${percent}%` }} />
                    </div>
                </div>
            )}

            {/* Log Area */}
            <div className="flex-1 overflow-hidden relative">
                <ul
                    ref={logsContainerRef}
                    className="scroll-isolated h-full overflow-y-auto custom-scrollbar p-4 text-xs font-mono leading-relaxed bg-base"
                >
                    {logs.length === 0 ? (
                        <li className="text-text-muted italic py-2">等待执行任务...</li>
                    ) : (
                        logs.map((log, index) => {
                            let textClass = 'text-text-secondary';
                            if (log.status === 'success') textClass = 'text-status-keep group-hover:text-status-keep';
                            else if (log.status === 'error') textClass = 'text-status-reject font-medium';
                            else if (log.status === 'highlight') textClass = 'text-text-primary font-medium';

                            return (
                                <li key={index} className="log-line flex items-baseline gap-3 mb-1 animate-fade-in group hover:bg-surface transition-colors px-2 py-0.5 rounded-sm">
                                    <span className="text-text-muted/60 shrink-0 select-none opacity-50 transition-opacity">[{log.time}]</span>
                                    <span className={`break-words ${textClass}`}>{log.text}</span>
                                </li>
                            );
                        })
                    )}
                </ul>
            </div>
                </>
            )}
        </div>
    );
}
