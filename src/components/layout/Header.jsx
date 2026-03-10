import React from 'react';

export default function Header() {
    return (
        <header className="relative z-10 w-full h-12 bg-base border-b border-white/5 px-4 flex items-center justify-between shadow-sm overflow-hidden flex-shrink-0">
            {/* Top accent line */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-accent/80" />

            {/* Brand */}
            <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-6 h-6 bg-accent border border-accent">
                    <svg className="w-4 h-4 text-base" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter">
                        <path d="M14.5 4h-5L7 7H4v12h16V7h-3l-2.5-3z" />
                        <circle cx="12" cy="13" r="3" />
                    </svg>
                </div>
                <div className="flex flex-col justify-center">
                    <h1 className="text-xs font-mono font-bold text-text-primary tracking-[0.2em] uppercase">
                        VisionCull <span className="text-accent">Pro</span>
                    </h1>
                </div>
            </div>

            {/* Middle decorative elements */}
            <div className="hidden md:flex items-center gap-2 opacity-30 pointer-events-none select-none">
                <div className="h-[1px] w-12 bg-text-muted" />
                <span className="text-[9px] font-mono tracking-widest text-text-muted">SYS.ACTIVE</span>
                <div className="h-[1px] w-12 bg-text-muted" />
            </div>

            {/* Status */}
            <div className="flex items-center gap-4">
                <span className="text-[10px] text-text-muted font-mono tracking-widest uppercase">v2.0.0</span>
                <div className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10">
                    <div className="w-1.5 h-1.5 bg-status-keep animate-pulse shadow-glow-keep" />
                    <span className="text-[10px] font-mono font-semibold text-text-secondary tracking-widest uppercase">Ready</span>
                </div>
            </div>
        </header>
    );
}
