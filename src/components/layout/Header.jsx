import React from 'react';

export default function Header() {
    return (
        <header className="relative z-10 w-full h-14 bg-panel border-b border-border px-6 flex items-center justify-between flex-shrink-0">
            {/* Brand */}
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                    <svg className="w-4 h-4 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                        <circle cx="12" cy="13" r="3" />
                    </svg>
                </div>
                <div>
                    <h1 className="text-sm font-semibold text-text-primary tracking-wide">
                        快选片
                    </h1>
                    <p className="text-[10px] text-text-muted -mt-0.5">VisionCull Pro</p>
                </div>
            </div>

            {/* Status */}
            <div className="flex items-center gap-3">
                <span className="text-[10px] text-text-muted font-mono">v2.0</span>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface border border-border">
                    <div className="w-1.5 h-1.5 rounded-full bg-status-keep animate-pulse" />
                    <span className="text-[11px] text-text-secondary">就绪</span>
                </div>
            </div>
        </header>
    );
}
