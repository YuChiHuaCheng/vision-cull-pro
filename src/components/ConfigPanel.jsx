import React, { useState } from 'react';
import { FolderOpen, Settings, Play } from 'lucide-react';
import { Bridge } from '../utils/bridge';

export default function ConfigPanel({ onStart, disabled }) {
    const [folderPath, setFolderPath] = useState('');
    const [threshold, setThreshold] = useState(200);

    const handleSelectFolder = async () => {
        const result = await Bridge.selectFolder();
        if (result && result.success && result.path) {
            setFolderPath(result.path);
        }
    };

    const handleStart = () => {
        if (!folderPath) return;
        onStart(folderPath, threshold);
    };

    return (
        <div className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-xl p-6 shadow-xl mb-6">
            <div className="flex flex-col md:flex-row gap-6">

                {/* Folder Selection */}
                <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                        Target Folder
                    </label>
                    <div className="flex gap-3">
                        <button
                            onClick={handleSelectFolder}
                            disabled={disabled}
                            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-lg flex items-center gap-2 transition-colors border border-slate-700"
                        >
                            <FolderOpen size={18} className="text-teal-500" />
                            Choose Directory
                        </button>
                        <div className="flex-1 px-4 py-2.5 bg-slate-950/50 border border-slate-800 rounded-lg text-slate-300 font-mono text-sm truncate flex items-center">
                            {folderPath || 'No folder selected'}
                        </div>
                    </div>
                </div>

                {/* Threshold Slider */}
                <div className="flex-1">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                            <Settings size={16} />
                            Blur Threshold
                        </label>
                        <span className="text-teal-400 font-mono bg-teal-500/10 px-2 py-0.5 rounded text-sm">
                            {threshold}
                        </span>
                    </div>
                    <div className="pt-2">
                        <input
                            type="range"
                            min="50"
                            max="500"
                            step="10"
                            value={threshold}
                            onChange={(e) => setThreshold(Number(e.target.value))}
                            disabled={disabled}
                            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-500 disabled:opacity-50"
                        />
                        <div className="flex justify-between text-xs text-slate-500 mt-2 font-medium">
                            <span>Forgiving (50)</span>
                            <span>Strict (500)</span>
                        </div>
                    </div>
                </div>

                {/* Start Button */}
                <div className="flex items-end">
                    <button
                        onClick={handleStart}
                        disabled={disabled || !folderPath}
                        className="h-[68px] px-8 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold rounded-xl flex items-center gap-3 transition-all transform active:scale-95 shadow-lg shadow-orange-500/20 disabled:shadow-none"
                    >
                        <Play size={20} fill="currentColor" />
                        <span className="text-lg">Start Scan</span>
                    </button>
                </div>

            </div>
        </div>
    );
}
