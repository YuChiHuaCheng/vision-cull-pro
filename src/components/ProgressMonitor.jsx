import React from 'react';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ProgressMonitor({
    isScanning,
    progressTotal,
    progressCurrent,
    statusMessage
}) {
    if (!isScanning && progressTotal === 0) return null;

    const percentage = progressTotal > 0 ? Math.round((progressCurrent / progressTotal) * 100) : 0;
    const isComplete = progressCurrent === progressTotal && progressTotal > 0 && !isScanning;

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg mb-6 relative overflow-hidden">

            {/* Background Progress Bar (Subtle) */}
            <div
                className="absolute top-0 left-0 h-1 bg-teal-500/80 transition-all duration-300 ease-out z-10"
                style={{ width: `${percentage}%` }}
            />
            <div className="absolute top-0 left-0 h-1 w-full bg-slate-800 z-0" />

            <div className="flex items-center justify-between z-20 relative">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
                        {isComplete ? (
                            <CheckCircle2 className="text-emerald-500" size={24} />
                        ) : isScanning ? (
                            <Loader2 className="text-teal-400 animate-spin" size={24} />
                        ) : (
                            <AlertCircle className="text-orange-500" size={24} />
                        )}
                    </div>

                    <div>
                        <h3 className="text-lg font-semibold text-slate-200">
                            {isComplete ? 'Scan Complete' : isScanning ? 'Analyzing Photos...' : 'Ready'}
                        </h3>
                        <p className="text-slate-400 text-sm mt-0.5 max-w-xl truncate">
                            {statusMessage || 'Awaiting instructions'}
                        </p>
                    </div>
                </div>

                <div className="text-right">
                    <div className="text-3xl font-light text-slate-100 font-mono tracking-tighter">
                        {percentage}%
                    </div>
                    <div className="text-xs text-slate-500 font-medium">
                        {progressCurrent} / {progressTotal}
                    </div>
                </div>
            </div>
        </div>
    );
}
