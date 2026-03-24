import React from 'react';
import { Copy, FileCode2 } from 'lucide-react';
import { Bridge } from '../utils/bridge';

export default function ActionBar({
    isComplete,
    folderPath,
    validPhotos,
    onActionComplete
}) {
    if (!isComplete || validPhotos.length === 0) return null;

    const handleCopy = async () => {
        const result = await Bridge.copyFiles(folderPath, validPhotos);
        if (result && result.success) {
            onActionComplete('Files copied successfully!');
        }
    };

    const handleXMP = async () => {
        // Basic mock mapping of result object format expected by back-end
        const results = validPhotos.reduce((acc, file) => {
            acc[file] = { keep: true };
            return acc;
        }, {});

        const result = await Bridge.createXmp(folderPath, results, true);
        if (result && result.success) {
            onActionComplete('XMP files created successfully!');
        }
    };

    return (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-800/90 backdrop-blur-md border border-slate-700 p-2 rounded-full shadow-2xl flex items-center gap-2 z-50">
            <div className="px-4 text-sm font-medium text-emerald-400">
                {validPhotos.length} Kept
            </div>
            <div className="w-px h-6 bg-slate-700 mx-1"></div>

            <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-full font-medium transition-colors border border-teal-500"
            >
                <Copy size={16} />
                Copy to New Folder
            </button>

            <button
                onClick={handleXMP}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-full font-medium transition-colors border border-slate-600"
            >
                <FileCode2 size={16} />
                Tag XMP File
            </button>
        </div>
    );
}
