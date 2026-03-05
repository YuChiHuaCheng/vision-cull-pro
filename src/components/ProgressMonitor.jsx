import React, { useEffect, useRef, useState } from 'react';

export default function ProgressMonitor({ isScanning, progressTotal, progressCurrent, statusMessage }) {
    const logsContainerRef = useRef(null);
    const [logs, setLogs] = useState([]);

    const addLog = (text, status = 'info') => {
        setLogs(prev => [...prev, {
            time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
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
            addLog(`开始分析 ${progressTotal} 张照片...`, 'highlight');
        }
    }, [isScanning, progressTotal]);

    useEffect(() => {
        if (statusMessage && statusMessage !== '等待执行指令...') {
            const isError = statusMessage.includes('错误') || statusMessage.includes('失败');
            addLog(statusMessage, isError ? 'error' : 'info');
        }
    }, [statusMessage]);

    const percent = progressTotal > 0 ? Math.round((progressCurrent / progressTotal) * 100) : 0;
    const isActive = isScanning || progressTotal > 0;

    return (
        <div className="flex flex-col h-full p-4 gap-3">
            {/* Header */}
            <div className="flex items-center justify-between flex-shrink-0">
                <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider">
                    处理日志
                </h2>
                {isActive && (
                    <span className="text-xs font-mono text-text-secondary">
                        {progressCurrent} / {progressTotal}
                    </span>
                )}
            </div>

            {/* Progress Bar */}
            {isActive && (
                <div className="flex-shrink-0">
                    <div className="flex justify-between text-[10px] text-text-muted mb-1">
                        <span>{isScanning ? '分析中...' : '已完成'}</span>
                        <span>{percent}%</span>
                    </div>
                    <div className="progress-bar">
                        <div className="fill" style={{ width: `${percent}%` }} />
                    </div>
                </div>
            )}

            {/* Log Area */}
            <div className="flex-1 rounded-lg bg-surface border border-border overflow-hidden flex flex-col min-h-0">
                <ul
                    ref={logsContainerRef}
                    className="scroll-isolated flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1 text-xs font-mono"
                >
                    {logs.length === 0 ? (
                        <li className="text-text-muted text-center py-8">等待分析任务...</li>
                    ) : (
                        logs.map((log, index) => {
                            let textClass = 'text-text-secondary';
                            if (log.status === 'success') textClass = 'text-status-keep';
                            else if (log.status === 'error') textClass = 'text-status-reject';
                            else if (log.status === 'highlight') textClass = 'text-accent font-medium';

                            return (
                                <li key={index} className="flex gap-2 animate-fade-in">
                                    <span className="text-text-muted shrink-0 select-none">{log.time}</span>
                                    <span className={`break-words ${textClass}`}>{log.text}</span>
                                </li>
                            );
                        })
                    )}
                </ul>
            </div>
        </div>
    );
}
