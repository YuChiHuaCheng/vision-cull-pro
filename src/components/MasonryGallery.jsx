import React from 'react';

export default function MasonryGallery({ photos, folderPath }) {
    if (photos.length === 0) {
        return (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 min-h-[300px] flex items-center justify-center text-slate-500">
                No approved photos yet. Run a scan to see results here.
            </div>
        );
    }

    return (
        <div
            id="gallery-container"
            className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg min-h-[500px]"
        >
            <div className="flex justify-between items-center mb-4 px-2 text-slate-400 font-medium text-sm">
                <span>Approved Previews</span>
                <span className="bg-slate-800 px-2 rounded text-slate-300">{photos.length} photos</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900">
                {photos.map((photoName, itemIndex) => {
                    const isMock = photoName.startsWith('photo_');
                    const imageSrc = isMock
                        ? `https://picsum.photos/seed/${itemIndex}/200/200`
                        : `local://${folderPath}/${photoName}`;

                    return (
                        <div key={photoName} className="aspect-square w-full rounded-lg overflow-hidden border border-slate-800 bg-slate-900 group relative">
                            <img
                                src={imageSrc}
                                alt={photoName}
                                loading="lazy"
                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2 text-xs font-mono truncate text-slate-300">
                                {photoName}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
