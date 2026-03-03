import React, { useState, useEffect } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';

export default function MasonryGallery({ photos, folderPath }) {
    // We need to know container width dynamically to adapt grid columns
    const [containerWidth, setContainerWidth] = useState(800);

    useEffect(() => {
        const updateWidth = () => {
            const el = document.getElementById('gallery-container');
            if (el) setContainerWidth(el.clientWidth);
        };
        updateWidth();
        window.addEventListener('resize', updateWidth);
        return () => window.removeEventListener('resize', updateWidth);
    }, []);

    const columnCount = Math.floor(containerWidth / 200);
    const rowCount = Math.ceil(photos.length / columnCount);

    // react-window grid sizing
    const columnWidth = containerWidth / columnCount;
    const rowHeight = 200; // fixed square for simplicity in virtualized setup

    // Cell renderer for react-window
    const Cell = ({ columnIndex, rowIndex, style }) => {
        const itemIndex = rowIndex * columnCount + columnIndex;
        if (itemIndex >= photos.length) return null;

        const photoName = photos[itemIndex];
        // In electron, we need `file://` protocol to load absolute path images
        // In dev mode mock, we might fallback to generic avatars or colored divs
        const isMock = photoName.startsWith('photo_');
        const imageSrc = isMock
            ? `https://picsum.photos/seed/${itemIndex}/200/200`
            : `local://${folderPath}/${photoName}`; // custom protocol set in main.js

        return (
            <div style={{ ...style, padding: '4px' }}>
                <div className="w-full h-full rounded-lg overflow-hidden border border-slate-800 bg-slate-900 group relative">
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
            </div>
        );
    };

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

            <Grid
                columnCount={columnCount}
                columnWidth={columnWidth}
                height={500}
                rowCount={rowCount}
                rowHeight={rowHeight}
                width={containerWidth - 32} // padding offset
                className="scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900"
            >
                {Cell}
            </Grid>
        </div>
    );
}
