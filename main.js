const { app, BrowserWindow, ipcMain, dialog, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

// Register the local scheme as privileged (allows loading media safely)
protocol.registerSchemesAsPrivileged([
    { scheme: 'local', privileges: { bypassCSP: true, supportFetchAPI: true, secure: true } }
]);

// ============================================================
// File Format Helpers
// ============================================================

const RAW_EXTENSIONS = ['.cr2', '.cr3', '.nef', '.nrw', '.arw', '.raf', '.dng'];
const JPG_EXTENSIONS = ['.jpg', '.jpeg'];
const ALL_IMAGE_EXTENSIONS = [...JPG_EXTENSIONS, ...RAW_EXTENSIONS];

function isJPG(filename) {
    const ext = path.extname(filename).toLowerCase();
    return JPG_EXTENSIONS.includes(ext);
}

function isRAW(filename) {
    const ext = path.extname(filename).toLowerCase();
    return RAW_EXTENSIONS.includes(ext);
}

function isImage(filename, formatFilter = 'all') {
    const ext = path.extname(filename).toLowerCase();
    if (formatFilter === 'raw') return RAW_EXTENSIONS.includes(ext);
    if (formatFilter === 'jpg') return JPG_EXTENSIONS.includes(ext);
    return ALL_IMAGE_EXTENSIONS.includes(ext);
}

// ============================================================
// Cache Management
// ============================================================

const SESSION_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const CACHE_PREFIX = 'visioncull-';
const cacheDir = path.join(os.tmpdir(), `${CACHE_PREFIX}${SESSION_ID}`);

function ensureCacheDir() {
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
    }
    return cacheDir;
}

function cleanupSessionCache() {
    try {
        if (fs.existsSync(cacheDir)) {
            fs.rmSync(cacheDir, { recursive: true, force: true });
            console.log(`[Cache] Cleaned session cache: ${cacheDir}`);
        }
    } catch (err) {
        console.error('[Cache] Failed to clean session cache:', err.message);
    }
}

function cleanupOrphanedCaches() {
    try {
        const tmpDir = os.tmpdir();
        const today = new Date().toDateString();
        const entries = fs.readdirSync(tmpDir);

        for (const entry of entries) {
            if (!entry.startsWith(CACHE_PREFIX)) continue;
            if (entry === `${CACHE_PREFIX}${SESSION_ID}`) continue; // skip current session

            const fullPath = path.join(tmpDir, entry);
            try {
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory() && stat.mtime.toDateString() !== today) {
                    fs.rmSync(fullPath, { recursive: true, force: true });
                    console.log(`[Cache] Cleaned orphaned cache: ${fullPath}`);
                }
            } catch (e) {
                // Skip entries we can't stat
            }
        }
    } catch (err) {
        console.error('[Cache] Failed orphan cleanup:', err.message);
    }
}

// ============================================================
// Exiftool Daemon (-stay_open mode)
// ============================================================

class ExiftoolDaemon {
    constructor() {
        this.process = null;
        this.stdoutBuffer = '';
        this.pendingResolve = null;
        this.ready = false;
    }

    start() {
        if (this.process) return;

        // Use bundled exiftool in production, or system exiftool in dev
        const exiftoolPath = app.isPackaged
            ? path.join(process.resourcesPath, 'bin', 'exiftool')
            : 'exiftool';

        this.process = spawn(exiftoolPath, ['-stay_open', 'true', '-@', '-']);

        this.process.stdout.on('data', (data) => {
            this.stdoutBuffer += data.toString('binary');
            this._processBuffer();
        });

        this.process.stderr.on('data', (data) => {
            console.error('[Exiftool STDERR]', data.toString());
        });

        this.process.on('error', (err) => {
            console.error('[Exiftool] Failed to start:', err.message);
            this.ready = false;
        });

        this.process.on('close', (code) => {
            console.log(`[Exiftool] Process exited with code ${code}`);
            this.process = null;
            this.ready = false;
        });

        this.ready = true;
    }

    _processBuffer() {
        // exiftool uses {ready} as sentinel between results
        const sentinel = '{ready}\n';
        let idx;
        while ((idx = this.stdoutBuffer.indexOf(sentinel)) !== -1) {
            const result = this.stdoutBuffer.slice(0, idx);
            this.stdoutBuffer = this.stdoutBuffer.slice(idx + sentinel.length);

            if (this.pendingResolve) {
                const resolve = this.pendingResolve;
                this.pendingResolve = null;
                resolve(result);
            }
        }
    }

    async execute(args) {
        if (!this.process || !this.ready) {
            throw new Error('Exiftool daemon not running');
        }

        return new Promise((resolve, reject) => {
            this.pendingResolve = resolve;

            // Write each arg on its own line, then -execute to trigger processing
            const command = args.join('\n') + '\n-execute\n';
            try {
                this.process.stdin.write(command);
            } catch (err) {
                this.pendingResolve = null;
                reject(err);
            }

            // Timeout after 30s
            setTimeout(() => {
                if (this.pendingResolve === resolve) {
                    this.pendingResolve = null;
                    reject(new Error('Exiftool command timed out'));
                }
            }, 30000);
        });
    }

    async extractPreview(filePath, outputPath) {
        try {
            const result = await this.execute([
                '-b', '-PreviewImage', '-w!', `${outputPath}/%f.jpg`, filePath
            ]);
            const baseName = path.parse(filePath).name;
            const previewPath = path.join(outputPath, `${baseName}.jpg`);
            if (fs.existsSync(previewPath)) {
                return previewPath;
            }
            // Fallback: try JpgFromRaw (Nikon)
            await this.execute([
                '-b', '-JpgFromRaw', '-w!', `${outputPath}/%f.jpg`, filePath
            ]);
            if (fs.existsSync(previewPath)) {
                return previewPath;
            }
            return null;
        } catch (err) {
            console.error(`[Exiftool] Preview extraction failed for ${filePath}:`, err.message);
            return null;
        }
    }

    async getExifData(filePath) {
        try {
            const result = await this.execute([
                '-json', '-DateTimeOriginal', '-ShutterSpeed', '-FocalLength',
                '-ISO', '-Model', '-BurstUUID', '-ContinuousShootingCount',
                filePath
            ]);
            const parsed = JSON.parse(result.trim());
            return parsed[0] || {};
        } catch (err) {
            console.error(`[Exiftool] EXIF read failed for ${filePath}:`, err.message);
            return {};
        }
    }

    stop() {
        if (this.process) {
            try {
                this.process.stdin.write('-stay_open\nfalse\n');
            } catch (e) {
                // Ignore
            }
            this.process = null;
            this.ready = false;
        }
    }
}

const exiftoolDaemon = new ExiftoolDaemon();

// ============================================================
// RAW+JPG Deduplication
// ============================================================

function deduplicateFiles(files) {
    // When both RAW and JPG exist for the same base name, keep RAW only
    const byBaseName = new Map();
    for (const file of files) {
        const baseName = path.parse(file).name;
        const existing = byBaseName.get(baseName);
        if (!existing) {
            byBaseName.set(baseName, file);
        } else {
            // Prefer RAW over JPG
            if (isRAW(file) && isJPG(existing)) {
                byBaseName.set(baseName, file);
            }
        }
    }
    return Array.from(byBaseName.values());
}

// ============================================================
// Window Management
// ============================================================

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 1000,
        minHeight: 700,
        titleBarStyle: 'hiddenInset',
        backgroundColor: '#111111',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    const isDev = process.env.NODE_ENV === 'development';

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
    }
}

app.whenReady().then(() => {
    // Handle the custom local:// protocol
    protocol.handle('local', (request) => {
        let filePath = request.url.slice('local://'.length);
        if (process.platform === 'win32' && filePath.startsWith('/')) {
            filePath = filePath.slice(1);
        }
        filePath = decodeURI(filePath);
        return net.fetch('file://' + filePath);
    });

    // Startup: clean orphaned caches from previous crashed sessions
    cleanupOrphanedCaches();

    // Start exiftool daemon
    exiftoolDaemon.start();

    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('before-quit', () => {
    exiftoolDaemon.stop();
    cleanupSessionCache();
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

// ============================================================
// IPC: Select Folder
// ============================================================

ipcMain.handle('dialog:openDirectory', async (event) => {
    const webContents = event.sender;
    const window = BrowserWindow.fromWebContents(webContents);

    const { canceled, filePaths } = await dialog.showOpenDialog(window, {
        properties: ['openDirectory', 'dontAddToRecent'],
        title: '选择照片文件夹',
        buttonLabel: '选择此文件夹'
    });

    if (canceled) {
        return { success: false, reason: '用户取消了选择' };
    }

    return { success: true, path: filePaths[0] };
});

// ============================================================
// IPC: Scan Files (returns file list with stats, no processing)
// ============================================================

ipcMain.handle('scan:files', async (event, targetPath, formatFilter) => {
    if (!targetPath || !fs.existsSync(targetPath)) {
        return { success: false, error: '所选路径不存在' };
    }

    try {
        const allItems = fs.readdirSync(targetPath);
        let files = [];

        for (const item of allItems) {
            const itemPath = path.join(targetPath, item);
            if (fs.statSync(itemPath).isFile() && isImage(item, formatFilter)) {
                files.push(item);
            }
        }

        // Deduplicate if scanning all formats
        if (formatFilter === 'all') {
            files = deduplicateFiles(files);
        }

        const rawCount = files.filter(f => isRAW(f)).length;
        const jpgCount = files.filter(f => isJPG(f)).length;

        return {
            success: true,
            files,
            total: files.length,
            rawCount,
            jpgCount,
        };
    } catch (err) {
        return { success: false, error: `扫描失败: ${err.message}` };
    }
});

// ============================================================
// IPC: Start Processing
// ============================================================

let activeProcessAbort = null;

ipcMain.on('process:start', async (event, targetPath, blurThreshold, formatFilter = 'all', aiConfig = { enabled: false }) => {
    if (!targetPath || !fs.existsSync(targetPath)) {
        event.sender.send('process:update', { type: 'error', message: '提供的路径不存在或为空' });
        return;
    }

    // Ensure cache directory
    const previewDir = ensureCacheDir();

    // Gather files
    let files = [];
    try {
        const allItems = fs.readdirSync(targetPath);
        for (const item of allItems) {
            const itemPath = path.join(targetPath, item);
            if (fs.statSync(itemPath).isFile() && isImage(item, formatFilter)) {
                files.push(item);
            }
        }
        if (formatFilter === 'all') {
            files = deduplicateFiles(files);
        }
    } catch (err) {
        event.sender.send('process:update', { type: 'error', message: '读取图片列表失败。' });
        return;
    }

    const total = files.length;
    event.sender.send('process:update', { type: 'start', total });

    if (total === 0) {
        event.sender.send('process:update', { type: 'done' });
        return;
    }

    // Abort controller for this session
    let aborted = false;
    activeProcessAbort = () => { aborted = true; };

    // ---- Determine analyzer approach ----
    // For now (Phase 1), still use Python analyzer if available
    // Phase 2 will migrate to JS/WASM
    let analyzerExecutable;
    let processArgs;

    if (app.isPackaged) {
        analyzerExecutable = path.join(process.resourcesPath, 'bin', 'analyzer');
        processArgs = [];
    } else {
        // Search for compatible Python venv with mediapipe
        const venvCandidates = [
            path.join(__dirname, '..', '.venv', 'bin', 'python3'),
            path.join(__dirname, '.venv', 'bin', 'python3'),
        ];
        const foundPython = venvCandidates.find(p => fs.existsSync(p));
        if (foundPython) {
            analyzerExecutable = foundPython;
            processArgs = ['analyzer.py'];
            console.log(`[Analyzer] Using Python: ${foundPython}`);
        } else {
            // Fallback: basic pass-through without analyzer (Phase 1 mock)
            analyzerExecutable = null;
            console.log('[Analyzer] No compatible Python venv found, using pass-through mode');
        }
    }

    // For RAW files, extract preview first using exiftool daemon
    const previewMap = new Map(); // fileName -> previewPath

    for (let i = 0; i < files.length; i++) {
        if (aborted) break;
        const file = files[i];

        if (isRAW(file)) {
            const filePath = path.join(targetPath, file);
            event.sender.send('process:update', {
                type: 'extracting',
                current: i + 1,
                total: files.length,
                fileName: file,
            });

            try {
                const previewPath = await exiftoolDaemon.extractPreview(filePath, previewDir);
                if (previewPath) {
                    previewMap.set(file, previewPath);
                }
            } catch (err) {
                console.error(`[Preview] Failed for ${file}:`, err.message);
            }
        } else {
            // JPG: use original file directly
            previewMap.set(file, path.join(targetPath, file));
        }
    }

    if (aborted) {
        event.sender.send('process:update', { type: 'cancelled' });
        activeProcessAbort = null;
        return;
    }

    // ---- Run analyzer ----
    if (aiConfig && aiConfig.enabled) {
        // --- Phase 2: AI Vision API Processing ---
        console.log(`[Analyzer] Using AI Vision API (${aiConfig.model})`);

        for (let i = 0; i < files.length; i++) {
            if (aborted) {
                event.sender.send('process:update', { type: 'cancelled' });
                activeProcessAbort = null;
                return;
            }

            const file = files[i];
            const analysisPath = previewMap.get(file) || path.join(targetPath, file);
            let keep = false;
            let reason = 'AI分析超时或失败';
            let tags = [];
            let score = 0;

            try {
                // Ensure image exists
                if (!fs.existsSync(analysisPath) || fs.statSync(analysisPath).size === 0) {
                    throw new Error("预览图提取失败或文件为空");
                }

                const base64Image = fs.readFileSync(analysisPath).toString('base64');

                // Call LLM
                const response = await net.fetch(`${aiConfig.apiUrl}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${aiConfig.apiKey}`
                    },
                    body: JSON.stringify({
                        model: aiConfig.model,
                        messages: [
                            {
                                role: "user",
                                content: [
                                    { type: "text", text: aiConfig.prompt },
                                    { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
                                ]
                            }
                        ],
                        response_format: { type: "json_object" },
                        temperature: 0.2
                    })
                });

                if (!response.ok) {
                    throw new Error(`API 错误: ${response.status} ${response.statusText}`);
                }

                const data = await response.json();
                let resultText = data.choices[0].message.content;
                resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();

                const aiResult = JSON.parse(resultText);
                keep = aiResult.keep === true;
                reason = aiResult.reason || 'AI 判定完成';
                tags = Array.isArray(aiResult.tags) ? aiResult.tags : [];
                score = typeof aiResult.score === 'number' ? aiResult.score : (keep ? 80 : 20);

                console.log(`[AI] ${file}: keep=${keep}, score=${score}, tags=[${tags.join(',')}]`);

            } catch (err) {
                console.error(`[AI] Failed for ${file}:`, err.message);
                reason = `AI API 错误: ${err.message}`;
            }

            event.sender.send('process:update', {
                type: 'progress',
                current: i + 1,
                fileName: file,
                keep,
                reason,
                tags,
                score,
                faces: [],
                originalPath: path.join(targetPath, file),
                previewPath: previewMap.get(file) || null,
            });
        }

        event.sender.send('process:update', { type: 'done' });
        activeProcessAbort = null;
        return;

    } else {
        // --- Phase 1: Local Python Processing ---
        if (!analyzerExecutable) {
            // No analyzer available — just pass all through as "keep" (Phase 1 fallback)
            for (let i = 0; i < files.length; i++) {
                if (aborted) break;
                const file = files[i];
                event.sender.send('process:update', {
                    type: 'progress',
                    current: i + 1,
                    fileName: file,
                    keep: true,
                    reason: '分析器未就绪，默认保留',
                    faces: [],
                    originalPath: path.join(targetPath, file),
                    previewPath: previewMap.get(file) || null,
                });
            }
            event.sender.send('process:update', { type: 'done' });
            activeProcessAbort = null;
            return;
        }

        const child = spawn(analyzerExecutable, processArgs);
        let current = 0;
        let stdoutBuffer = '';

        function processNext() {
            if (aborted) {
                try { child.stdin.write("exit\n"); } catch (e) { }
                event.sender.send('process:update', { type: 'cancelled' });
                return;
            }
            if (current >= total) {
                try { child.stdin.write("exit\n"); } catch (e) { }
                event.sender.send('process:update', { type: 'done' });
                activeProcessAbort = null;
                return;
            }

            const file = files[current];
            // Use preview image for analysis if available (RAW files)
            const analysisPath = previewMap.get(file) || path.join(targetPath, file);
            const payload = JSON.stringify({ file: analysisPath, threshold: blurThreshold });
            child.stdin.write(payload + "\n");
        }

        child.stdout.on('data', (data) => {
            stdoutBuffer += data.toString();
            const lines = stdoutBuffer.split('\n');
            stdoutBuffer = lines.pop();

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;

                if (trimmed === 'READY') {
                    processNext();
                    continue;
                }

                const file = files[current];
                const filePath = path.join(targetPath, file);
                let keep = false;
                let reason = '';
                let faces = [];

                try {
                    const result = JSON.parse(trimmed);
                    keep = result.keep === true;
                    reason = result.reason || '';
                    faces = result.faces || [];
                } catch (err) {
                    keep = false;
                    reason = '分析器输出异常或解析失败';
                }

                current++;

                event.sender.send('process:update', {
                    type: 'progress',
                    current,
                    fileName: file,
                    keep,
                    reason,
                    faces,
                    originalPath: filePath,
                    previewPath: previewMap.get(file) || null,
                });

                processNext();
            }
        });

        child.stderr.on('data', (data) => {
            console.error('ANALYZER ERROR:', data.toString());
        });

        child.on('error', (err) => {
            console.error('Failed to start analyzer:', err);
            event.sender.send('process:update', { type: 'error', message: '无法启动分析引擎' });
        });

        child.on('close', (code) => {
            if (current < total && !aborted) {
                event.sender.send('process:update', {
                    type: 'error',
                    message: `分析引擎异常退出 (代码 ${code})`
                });
            }
        });
    }
});

// IPC: Cancel Processing
ipcMain.on('process:cancel', () => {
    if (activeProcessAbort) {
        activeProcessAbort();
        activeProcessAbort = null;
    }
});

// ============================================================
// IPC: Copy Files
// ============================================================

ipcMain.handle('action:copyFiles', async (event, sourcePath, fileNames) => {
    try {
        const folderName = path.basename(sourcePath);
        const goodDir = path.join(path.dirname(sourcePath), `${folderName}_Selected`);
        if (!fs.existsSync(goodDir)) {
            fs.mkdirSync(goodDir, { recursive: true });
        }

        let copied = 0;
        for (const file of fileNames) {
            const safeName = path.basename(file);
            const src = path.join(sourcePath, safeName);
            const dst = path.join(goodDir, safeName);
            if (!dst.startsWith(goodDir)) continue;
            if (fs.existsSync(src)) {
                fs.copyFileSync(src, dst);
                copied++;
            }
        }
        return { success: true, copied, outputDir: goodDir };
    } catch (error) {
        console.error('Error copying files:', error);
        return { success: false, error: error.message };
    }
});

// ============================================================
// IPC: Check XMP Conflict
// ============================================================

ipcMain.handle('action:checkXmpConflict', async (event, sourcePath, fileNames) => {
    try {
        let conflictCount = 0;
        for (const file of fileNames) {
            const baseName = path.parse(file).name;
            const xmpPath = path.join(sourcePath, `${baseName}.xmp`);
            if (fs.existsSync(xmpPath)) {
                conflictCount++;
            }
        }
        return { conflict: conflictCount > 0, conflictCount };
    } catch (error) {
        return { conflict: false, conflictCount: 0 };
    }
});

// ============================================================
// IPC: Create XMP (Enhanced with Keywords)
// ============================================================

ipcMain.handle('action:createXmp', async (event, sourcePath, results, overwrite) => {
    try {
        let created = 0;
        for (const res of results) {
            const safeName = path.basename(res.fileName);
            const baseName = path.parse(safeName).name;
            const xmpPath = path.join(sourcePath, `${baseName}.xmp`);

            if (!xmpPath.startsWith(sourcePath)) continue;
            if (!overwrite && fs.existsSync(xmpPath)) continue;

            // Ensure rating logic is sound and use custom score if provided by AI
            let rating = res.keep ? 3 : 1;
            if (typeof res.score === 'number') {
                // Map 0-100 score to 1-5 rating (e.g. 0-20=1, 21-40=2, 41-60=3, 61-80=4, 81-100=5)
                rating = Math.max(1, Math.min(5, Math.ceil(res.score / 20)));
            }

            const colorLabel = res.keep ? 'Green' : 'Red';
            const statusTag = res.keep ? '快选片_保留' : '快选片_淘汰';

            // Build keyword lists
            const tags = res.tags || [];
            const allSubjects = [statusTag, ...tags];
            const subjectXml = allSubjects
                .map(t => `     <rdf:li>${escapeXml(t)}</rdf:li>`)
                .join('\n');

            // Build hierarchical subjects
            const hierarchicalTags = [`快选片|${res.keep ? '保留' : '淘汰'}`, ...tags];
            const hierarchicalXml = hierarchicalTags
                .map(t => `     <rdf:li>${escapeXml(t)}</rdf:li>`)
                .join('\n');

            // Build description (AI reason summary)
            const description = res.reason || '';

            const xmpContent = `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:xmp="http://ns.adobe.com/xap/1.0/"
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:lr="http://ns.adobe.com/lightroom/1.0/">
   <xmp:Rating>${rating}</xmp:Rating>
   <xmp:Label>${colorLabel}</xmp:Label>
   <dc:subject>
    <rdf:Bag>
${subjectXml}
    </rdf:Bag>
   </dc:subject>
   <lr:hierarchicalSubject>
    <rdf:Bag>
${hierarchicalXml}
    </rdf:Bag>
   </lr:hierarchicalSubject>
   <dc:description>
    <rdf:Alt>
     <rdf:li xml:lang="x-default">${escapeXml(description)}</rdf:li>
    </rdf:Alt>
   </dc:description>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;

            fs.writeFileSync(xmpPath, xmpContent, 'utf8');
            created++;
        }
        return { success: true, created };
    } catch (error) {
        console.error('Error creating XMP:', error);
        return { success: false, error: error.message };
    }
});

function escapeXml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ============================================================
// IPC: Analytics
// ============================================================

ipcMain.on('analytics:track', (event, payload) => {
    try {
        const appDataPath = app.getPath('userData');
        const logPath = path.join(appDataPath, 'analytics.log');
        const logEntry = JSON.stringify(payload) + '\n';
        fs.appendFileSync(logPath, logEntry, 'utf8');
    } catch (err) {
        console.error('Analytics writing error:', err);
    }
});
