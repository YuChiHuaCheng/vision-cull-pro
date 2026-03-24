import React from 'react';

export default function Header({ theme, toggleTheme }) {
    return (
        <header className="relative z-10 w-full h-[52px] bg-base border-b border-border px-6 flex items-center justify-between shadow-sm overflow-hidden flex-shrink-0 transition-colors duration-300">
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

            {/* Status & Theme Toggle */}
            <div className="flex items-center gap-6">
                <button 
                    onClick={toggleTheme}
                    className="flex items-center justify-center w-8 h-8 rounded-full border border-border bg-surface text-text-secondary hover:text-text-primary hover:border-text-muted transition-all"
                    title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
                >
                    {theme === 'dark' ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                    ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                        </svg>
                    )}
                </button>

                <div className="flex items-center gap-4">
                    <span className="text-[10px] text-text-muted font-mono tracking-widest uppercase hidden md:inline">v2.0.0</span>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-border rounded shadow-soft-sm">
                        <div className="w-1.5 h-1.5 bg-status-keep animate-pulse rounded-full shadow-[0_0_8px_rgba(var(--status-keep),0.6)]" />
                        <span className="text-[10px] font-mono font-bold text-text-secondary tracking-widest uppercase">Ready</span>
                    </div>
                </div>
            </div>
        </header>
    );
}
